const Dotenv = require('dotenv');
Dotenv.config({
  silent: true
});

const doNotReply = "\nThis is an anonymous, machine generated text. Please do not reply."

const dispatchPending = "Pending";
const dispatchAccepted = "Accepted";
const dispatchRejected = "Rejected";
const dispatchEnded = "Ended";

const rejectedMessage = "The dispatcher is unable to respond to your request. Please call 911!"

class Responder {
  constructor(mapsReverseGeocode,twilioCreateMessage) {
    this.mapsReverseGeocode = mapsReverseGeocode;
    this.twilioCreateMessage = twilioCreateMessage;

    this.emergencyToDispatch = {};

    this.emergencyToAddress = {};
    this.emergencyToLatLng = {};
    // Note that expires is done on the device so that there is no danger of the server being unable
    // to send a rejection in time.
    this.emergencyToCallback = {};
    this.emergencyToPhoneNumber = {};
    this.emergencyToDescription = {};
    this.emergencyToDescNumber = {};
  }

  handleLatLng(emergencyID, latLng, callback) {
    mapsReverseGeocode({
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
          this.emergencyToAddress[emergencyID] = address;
          this.emergencyToLatLng[emergencyID] = latLng;
          this.emergencyToDescription[emergencyID] = "No updates from the caller yet.";
          this.emergencyToDescNumber[emergencyID] = 1;

          twilioCreateMessage({
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

  updateLatLng(emergencyID, latLng, callback) {
    mapsReverseGeocode({
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
          this.emergencyToAddress[emergencyID] = address;
          this.emergencyToLatLng[emergencyID] = latLng;

          twilioCreateMessage({
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

  updateDescription(emergencyID, newDescription, callback) {
    if (!emergencyToDescription.hasOwnProperty(emergencyID)) {
      console.error("Trying to access non-existant key:", emergencyID, "in dictionary", emergencyToDescription);
      callback(false, "Emergency not found.", 500);
      return;
    }

    oldDescr = emergencyToDescription[emergencyID];
    oldNum = emergencyToDescNumber[emergencyID];
    updatedDescr = "Update " + oldNum + ":\n" + newDescription;
    if (oldNum == 1) {
      this.emergencyToDescription[emergencyID] = updatedDescr;
    } else {
      this.emergencyToDescription[emergencyID] = updatedDescr + "\n\n" + oldDescr;
    }
    this.emergencyToDescNumber[emergencyID] += 1;


    twilioCreateMessage({
      from: process.env.TWILIO_NUMBER,
      to: process.env.DISPATCH_NUMBER,
      body: "Emergency: " + emergencyID + " has received an updated description:\n" + newDescription
    });
  }

  prepareDispatch(emergencyID, phoneNumber, isSMS) {
    var called = false;
    var callback;
    this.emergencyToDispatch[emergencyID] = dispatchPending;
    this.emergencyToPhoneNumber[emergencyID] = phoneNumber
    if (isSMS) {
      callback = (canHandle) => {
        if (called) {
          console.error("Calling callback more than once.");
          return;
        }

        const handledText = "Help is on the way!" + doNotReply;
        const failedText = rejectedMessage + doNotReply;
        this.emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;

        twilioCreateMessage({
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

        this.emergencyToDispatch[emergencyID] = canHandle ? dispatchAccepted : dispatchRejected;
      }
    }
    this.emergencyToCallback[emergencyID] = callback;
  }

  acceptDispatch(emergencyID, canHandle, callback) {
    if (!emergencyToCallback.hasOwnProperty(emergencyID)) {
      console.error("Trying to access non-existant key:", emergencyID, "in dictionary",
        emergencyToCallback);
      callback(false, "Emergency not found.", 500);
      return;
    }
    this.emergencyToCallback[emergencyID](canHandle);
    if (!canHandle) {
      this.expireLocation(emergencyID, true, rejectedMessage, callback);
      this.emergencyToDispatch[emergencyID] = dispatchRejected;
    } else {
      callback(true, "Success.", 200);
    }
  }

  getDispatchStatus(emergencyID) {
    return this.emergencyToDispatch[emergencyID];
  }

  getLocationJSON(emergencyID) {
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

  expireLocation(emergencyID, wasDispatcher, reason, callback) {
    var reciever;
    if (wasDispatcher) {
      reciever = emergencyToPhoneNumber[emergencyID];
    } else {
      reciever = process.env.DISPATCH_NUMBER;
    }

    delete emergencyToCallback[emergencyID];
    this.emergencyToDispatch[emergencyID] = dispatchEnded;
    delete emergencyToAddress[emergencyID];
    delete emergencyToPhoneNumber[emergencyID];
    delete emergencyToLatLng[emergencyID];

    twilioCreateMessage({
        from: process.env.TWILIO_NUMBER,
        to: reciever,
        body: reason + doNotReply
      }).then((messsage) => callback(true, "Success.", 200))
      .catch((messsage) => {
        console.error(message);
        callback(false, "Internal server error.", 500)
      });
  }
}



  


module.exports = {
  Responder
};