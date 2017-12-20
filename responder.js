const Dotenv = require('dotenv');
Dotenv.config({
  silent: true
});

const mapsClient = require('@google/maps').createClient({
  key: process.env.MAPS_KEY
});

const twilioClient = require('twilio')(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
);

const doNotReply = "\nThis is an anonymous, machine generated text. Please do not reply."

const dispatchPending = "Pending";
const dispatchAccepted = "Accepted";
const dispatchRejected = "Rejected";
const dispatchEnded = "Ended";

const rejectedMessage = "The dispatcher is unable to respond to your request. Please call 911!"
var emergencyToDispatch = {};

var emergencyToAddress = {};
var emergencyToLatLng = {};
// Note that expires is done on the device so that there is no danger of the server being unable
// to send a rejection in time.
var emergencyToCallback = {};
var emergencyToPhoneNumber = {};
var emergencyToDescription = {};
var emergencyToDescNumber = {};

function handleLatLng(emergencyID, latLng, callback) {
  mapsClient.reverseGeocode({
      latlng: latLng,
      result_type: ['country', 'street_address'],
      location_type: ['ROOFTOP', 'APPROXIMATE', "RANGE_INTERPOLATED", "APPROXIMATE"],
      language: "EN"
    },
    function(err, response) {
      if (Object.keys(response.json.results).length == 0) {
        console.log("Empty Google Maps response.");
        callback(false, "Internal server error.", 500);
        return;
      }
      if (!err) {
        const address = response.json.results[0]["formatted_address"];
        emergencyToAddress[emergencyID] = address;
        emergencyToLatLng[emergencyID] = latLng;
        emergencyToDescription[emergencyID] = "No updates from the caller yet.";
        emergencyToDescNumber[emergencyID] = 1;

        callback(true, "Success.", 200);
        return "DEBUGGING";
        twilioClient.messages.create({
            from: process.env.TWILIO_NUMBER,
            to: process.env.DISPATCH_NUMBER,
            body: "This text is sent to report an opioid overdose at " + address + ". This is emergency " +
              emergencyID + ". This is latitude, longitude: " + latLng +
              ". If you are able to handle to this emergency, please respond \"yes " + emergencyID +
              "\". Otherwise, please respond \"no " + emergencyID + "\" if you are unable to handle this emergency."
          }).then((messsage) => callback(true, "Success.", 200))
          .catch((messsage) => callback(false, "Internal server error.", 500));
      } else {
        console.log(err)
        callback(false, "Internal server error.", 500);
      }
    }
  )
}

function updateLatLng(emergencyID, latLng, callback) {
  mapsClient.reverseGeocode({
      latlng: latLng,
      result_type: ['country', 'street_address'],
      location_type: ['ROOFTOP', 'APPROXIMATE', "RANGE_INTERPOLATED", "APPROXIMATE"],
      language: "EN"
    },
    function(err, response) {
      if (Object.keys(response.json.results).length == 0) {
        console.log("Empty Google Maps response.");
        callback(false, "Internal server error.", 500);
        return;
      }
      if (!err) {
        const address = response.json.results[0]["formatted_address"];
        emergencyToAddress[emergencyID] = address;
        emergencyToLatLng[emergencyID] = latLng;

        callback(true, "Success.", 200);
        return "DEBUGGING";
        twilioClient.messages.create({
            from: process.env.TWILIO_NUMBER,
            to: process.env.DISPATCH_NUMBER,
            body: "Emergency: " + emergencyID + " has received an update location." +
              " The new address is: " + address + ". This is latitude, longitude: " + latLng + "." +
              doNotReply
          }).then((messsage) => callback(true, "Success.", 200))
          .catch((messsage) => callback(false, "Internal server error.", 500));
      } else {
        console.log(err)
        callback(false, "Internal server error.", 500);
      }
    }
  )
}

function updateDescription(emergencyID, newDescription, callback) {
  if (!emergencyToDescription.hasOwnProperty(emergencyID)) {
    console.error("Trying to access non-existant key:", emergencyID, "in dictionary", emergencyToDescription);
    callback(false, "Emergency not found.", 500);
    return;
  }

  oldDescr = emergencyToDescription[emergencyID];
  oldNum = emergencyToDescNumber[emergencyID];
  updatedDescr = "Update " + oldNum + ":\n" + newDescription;
  if (oldNum == 1) {
    emergencyToDescription[emergencyID] = updatedDescr;
  } else {
    emergencyToDescription[emergencyID] = updatedDescr + "\n\n" + oldDescr;
  }
  emergencyToDescNumber[emergencyID] += 1;


  callback(true, "Success.", 200);
  return "DEBUGGING";
  twilioClient.messages.create({
    from: process.env.TWILIO_NUMBER,
    to: process.env.DISPATCH_NUMBER,
    body: "Emergency: " + emergencyID + " has received an updated description:\n" + newDescription
  });
}

function prepareDispatch(emergencyID, phoneNumber, isSMS) {
  var called = false;
  var callback;
  emergencyToDispatch[emergencyID] = dispatchPending;
  emergencyToPhoneNumber[emergencyID] = phoneNumber
  if (isSMS) {
    callback = (canHandle) => {
      if (called) {
        console.error("Calling callback more than once.");
        return;
      }

      const handledText = "Help is on the way!" + doNotReply;
      const failedText = rejectedMessage + doNotReply;
      emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;
      return "DEBUGGING";
      twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: phoneNumber,
        body: canHandle ? handledText : failedText
      }).catch((messsage) => console.error("Unable to respond to the caller."));
    }
  } else {
    callback = (canHandle) => {
      if (called) {
        console.error("Calling callback more than once.");
        return;
      }

      emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;
    }
  }
  emergencyToCallback[emergencyID] = callback;
}

function acceptDispatch(emergencyID, canHandle, callback) {
  if (!emergencyToCallback.hasOwnProperty(emergencyID)) {
    console.error("Trying to access non-existant key:", emergencyID, "in dictionary",
      emergencyToCallback);
    callback(false, "Emergency not found.", 500);
    return;
  }
  emergencyToCallback[emergencyID](canHandle);
  if (!canHandle) {
    expireLocation(emergencyID, true, rejectedMessage, callback);
    // HACK: Nothing should be done after the callback is called, but I could not figure out how to pass a status
    // into a function that could be also called from index.js
    // So we do that here.
    emergencyToDispatch[emergencyID] = dispatchRejected;
  } else {
    callback(true, "Success.", 200);
  }
}

function getDispatchStatus(emergencyID) {
  return emergencyToDispatch[emergencyID];
}

function getLocationJSON(emergencyID) {
  const address = emergencyToAddress[emergencyID];
  const latLng = emergencyToLatLng[emergencyID];
  const description = emergencyToDescription[emergencyID]
  if (!address || !latLng) {
    return undefined
  }
  return JSON.stringify({
    "address": address,
    "latLng": latLng,
    "description": description
  })
}

function expireLocation(emergencyID, wasDispatcher, reason, callback) {
  var reciever;
  if (wasDispatcher) {
    reciever = emergencyToPhoneNumber[emergencyID];
  } else {
    reciever = process.env.DISPATCH_NUMBER;
  }

  delete emergencyToCallback[emergencyID];
  emergencyToDispatch[emergencyID] = dispatchEnded;
  delete emergencyToAddress[emergencyID];
  delete emergencyToPhoneNumber[emergencyID];
  delete emergencyToLatLng[emergencyID];

  callback(true, "Success.", 200);
  return "DEBUGGING";


  twilioClient.messages.create({
      from: process.env.TWILIO_NUMBER,
      to: reciever,
      body: reason + doNotReply
    }).then((messsage) => callback(true, "Success.", 200))
    .catch((messsage) => {
      console.error(message);
      callback(false, "Internal server error.", 500)
    });
}

module.exports = {
  handleLatLng,
  getLocationJSON,
  expireLocation,
  prepareDispatch,
  acceptDispatch,
  getDispatchStatus,
  updateLatLng,
  updateDescription
};