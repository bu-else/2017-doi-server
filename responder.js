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

const dispatchPending = "Pending";
const dispatchAccepted = "Accepted";
const dispatchRejected = "Rejected";
var emergencyToDispatch = {};

var emergencyToAddress = {};
var emergencyToLatLng = {};
// Note that expires is done on the device so that there is no danger of the server being unable
// to send a rejection in time.
var emergencyToCallback = {};

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
        twilioClient.messages.create({
            from: process.env.TWILIO_NUMBER,
            to: process.env.BEN_NUMBER,
            body: "This text is sent to report an opioid overdose at " + address + ". This is emergency " + emergencyID +
              ". If you are able to handle to this emergency, please respond \"yes " +  emergencyID.toLowerCase() + "\"." +
              " Otherwise, please respond \"no " +  emergencyID.toLowerCase() + "\" if you are unable to handle this emergency."
          }).then((messsage) => callback(true, "Success.", 200))
          .catch((messsage) => callback(false, "Internal server error.", 500));
      } else {
        console.log(err)
        callback(false, "Internal server error.", 500);
      }
    }
  )
}

function handleAddress(emergencyID, address, zipcode, callback) {
  // Because we are just receiving a street address and a zipcode, without a city, state or country
  // we insert it carefully
  oldAddress = emergencyToAddress[emergencyID];
  formatted = oldAddress.split(",");
  formatted[0] = address;
  formatted[2] = formatted[2].slice(0, 4) + zipcode;
  emergencyToAddress[emergencyID] = formatted.join()
  twilioClient.messages.create({
      from: process.env.TWILIO_NUMBER,
      to: process.env.BEN_NUMBER,
      body: "Emergency " + emergencyID + " has recieved an updated address: " + address + ". Zipcode: " + zipcode +
        ". This is an anonymous, machine generated text. Please do not reply."
    }).then((messsage) => callback(true, "Success.", 200))
    .catch((messsage) => callback(false, "Internal server error.", 500));
}

function prepareDispatch(emergencyID, phoneNumber, isSMS) {
  var called = false;
  var callback;
  emergencyToDispatch[emergencyID] = dispatchPending;
  if (isSMS) {
    callback = (canHandle) => {
      if (called) {
        console.log("Calling callback twice.");
        return;
      }

      const handledText = "Help is on the way!";
      const failedText = "The dispatcher is unable to respond to your request. Please call 911!"
      emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;

      twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: phoneNumber,
        body: canHandle ? handledText : failedText
      }).catch((messsage) => console.log("Unable to respond to the caller."));
    }
  } else {
    callback = (canHandle) => {
      if (called) {
        console.log("Calling callback twice.");
        return;
      }

      emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;
    }
  }
  emergencyToCallback[emergencyID] = callback;
}

function acceptDispatch(emergencyID,canHandle,callback) {
  if (!emergencyToCallback.hasOwnProperty(emergencyID)) {
    console.log("Trying to access non-existant key:",emergencyID,"in dictionary",emergencyToCallback);
    callback(false, "Emergency not found.", 500);
    return false;
  }
  emergencyToCallback[emergencyID](canHandle);
  return true;
}

function getDispatchStatus(emergencyID) {
  return emergencyToDispatch[emergencyID];
}

function getLocationJSON(emergencyID) {
  const address = emergencyToAddress[emergencyID];
  const latLng = emergencyToLatLng[emergencyID];
  if (!address || !latLng) {
    return undefined
  }
  return JSON.stringify({
    "address": address,
    "latLng": latLng
  })
}

function expireLocation(emergencyID) {
  delete emergencyToAddress[emergencyID];
  delete emergencyToLatLng[emergencyID];
}

module.exports = {
  handleLatLng,
  handleAddress,
  getLocationJSON,
  expireLocation,
  prepareDispatch,
  acceptDispatch,
  getDispatchStatus
};