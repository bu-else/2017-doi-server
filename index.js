// content of index.js
const http = require('http');
const port = process.env.PORT || 3000;
const responder = require("./responder.js");
const idGen = require("./idgenerator.js");
const uuidv4 = require('uuid/v4');
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

const stageLatLng = 1;
const stageAddress = 2;
const stageEnded = -1;

// If expirationTime is set to -1, requests will never expire
// Otherwise, a good value is ten minutes
const minute = 60 * 1000;
const expirationTime = -1;
const reasonExpired = "expired."
const reasonDispatcher = "Your emergency was successfully handled by the dispatcher."
const reasonCaller = "was ended successfully by its caller.";

const requestHandler = (request, response) => {
  if (request.url.toString() == "/") {
    response.end("Wecome to the server of the 2017-doi-app!");
  }

  callback = callbackCreator(response, false)

  var result = request.url.toString().split("/");
  if (result.length != 3) {
    callback(false, "Page not found.", 404);
    return;
  }
  URL_GET = buildURL_GET(request.url.toString())

  switch (result[1]) {
    case "start-call":
      prepLatLng(URL_GET["DeviceID"], URL_GET["LatLng"], URL_GET["From"], false, callback);
      break;

    case "update-latlng":
      prepUpdateLatLng(URL_GET["DeviceID"], URL_GET["LatLng"], callback);
      break;

    case "update-description":
      prepUpdateDescription(URL_GET["DeviceID"], URL_GET["Description"], callback);
      break;

    case "end-emergency":
      var reason;
      if (URL_GET["DeviceID"]) {
        reason = reasonCaller;
      } else {
        reason = reasonDispatcher;
      }
      endEmergency(URL_GET["DeviceID"], URL_GET["EmergencyID"], reason, callback);
      break;

    case "dispatch-status":
      getDispatch(URL_GET["DeviceID"], URL_GET["EmergencyID"], response, callback);
      break;

    case "fetch-info":
      fetchAddress(URL_GET["DeviceID"], URL_GET["EmergencyID"], response, callback);
      break;

    case "sms":
      smsHandler(response, URL_GET["Body"], URL_GET["From"]);
      break;

    default:
      callback(false, "Page not found.", 404);
      break;
  }
}

function smsHandler(response, body, phoneNumber) {
  result = body.split("\n");

  callback = callbackCreator(response, true);
  const firstLine = result[0].split("+");
  console.log((strip(phoneNumber),strip(process.env.DISPATCH_NUMBER);
  if (strip(phoneNumber) == strip(process.env.DISPATCH_NUMBER) && firstLine.length >= 2) {
    console.log("CALLED",firstLine.toLowerCase());
    switch (firstLine[0].toLowerCase()) {
      case "yes":
        responder.acceptDispatch(firstLine[1].toUpperCase(), true, callback);
        break;
      case "no":
        responder.acceptDispatch(firstLine[1].toUpperCase(), false, callback);
        break;
      default:
        callback(false, "Request not found.", 404);
        break;
    }
    return;
  }

  switch (result[0]) {
    case "start-call":
      prepLatLng(result[1], result[2], phoneNumber, true, callback);
      break;

    case "update-latlng":
      prepUpdateLatLng(result[1], result[2], callback);
      break;

    case "end-emergency":
      // Ending by sms is only supported on the caller side
      endEmergency(result[1], undefined, reasonCaller, callback);
      break;

    default:
      callback(false, "Request not found.", 404);
      break;
  }
}

function prepLatLng(deviceID, latLng, phoneNumber, isSMS, callback) {
  if (!deviceID || !latLng || !phoneNumber) {
    callback(false, "Invalid request.", 400);
    return false;
  }

  var emergencyID;
  try {
    emergencyID = idGen.makeByDevice(deviceID);
    idGen.setStageByEmergency(emergencyID, stageLatLng);
  } catch (e) {
    console.error(e);
    callback(false, "Internal server error.", 500);
    return false;
  }

  responder.prepareDispatch(emergencyID, phoneNumber, isSMS);
  responder.handleLatLng(emergencyID, latLng, callback);

  // As mentioned above, just change expiration time to -1 to never expire emergencies
  if (expirationTime == -1) {
    console.log("Not expiring addresses.");
    return true;
  }
  setTimeout(function() {
    endEmergency(deviceID, emergencyID, phoneNumber, reasonExpired, function(s, t, c) {
      console.log("Emergency " + emergencyID + " timed out.");
      console.log("Result of timeout was: ", s, t, c);
    });
  }, expirationTime);
  return true;
}

function prepUpdateLatLng(deviceID, latLng, callback) {
  if (!deviceID || !latLng) {
    callback(false, "Invalid request.", 400);
    return;
  }

  const emergencyID = tryGetEmergencyID(deviceID, callback);
  if (!emergencyID) {
    return;
  }

  try {
    idGen.setStageByEmergency(emergencyID, stageAddress);
  } catch (e) {
    console.error(e);
    callback(false, "Internal server error.", 500);
    return;
  }

  responder.updateLatLng(emergencyID, latLng, callback);
}

function prepUpdateDescription(deviceID, description, callback) {
  if (!deviceID || !description) {
    callback(false, "Invalid request.", 400);
    return;
  }

  const emergencyID = tryGetEmergencyID(deviceID, callback);
  if (!emergencyID) {
    return;
  }

  responder.updateDescription(emergencyID, description, callback);
}

function getDispatch(deviceID, emergencyID, response, callback) {
  if (!deviceID && !emergencyID) {
    callback(false, "Invalid request.", 400);
    return;
  }

  if (!emergencyID) {
    try {
      emergencyID = idGen.getEmergencyFromArchive(deviceID);
    } catch (e) {
      console.error(e);
      callback(false, "Could not find emergency.", 404);
      return;
    }
  }

  response.end(responder.getDispatchStatus(emergencyID));
}

function fetchAddress(deviceID, emergencyID, response, callback) {
  if (!deviceID && !emergencyID) {
    callback(false, "Invalid request.", 400);
    return;
  }

  if (!emergencyID) {
    emergencyID = tryGetEmergencyID(deviceID, callback);
    if (!emergencyID) {
      // We were unable to get the emergencyID from our storage and it was not passed in
      // So we must stop
      return;
    }
  }

  json = responder.getLocationJSON(emergencyID);
  if (!json) {
    callback(false, "Location not found.", 404);
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(json);
}

function endEmergency(deviceID, emergencyID, reason, callback) {
  if (!deviceID && !emergencyID) {
    callback(false, "Invalid request.", 400);
    return;
  }

  if (!emergencyID) {
    emergencyID = tryGetEmergencyID(deviceID, callback);
    if (!emergencyID) {
      // We were unable to get the emergencyID from our storage and it was not passed in
      // So we must stop
      return;
    }
  }

  wasDispatcher = reason == reasonDispatcher;
  if (!wasDispatcher) {
    // We need to suffix the reason we send to dispatcher with the emergency ID.
    reason = "Emergency " + emergencyID + " " + reason;
  }

  try {
    idGen.endByEmergency(emergencyID);
    responder.expireLocation(emergencyID, wasDispatcher, reason, callback);
  } catch (e) {
    console.error(e);
    callback(false, "Internal server error.", 500);
    return;
  }
}

function tryGetEmergencyID(deviceID, callback) {
  var emergencyID;
  try {
    emergencyID = idGen.getEmergencyByDevice(deviceID);
  } catch (e) {
    console.error(e);
    callback(false, "Could not find emergency.", 404);
  }
  return emergencyID;
}

function callbackCreator(response, isSMS) {
  var called = false;
  var callback;
  if (isSMS) {
    callback = (success, text, code) => {
      if (called) {
        console.error("Calling callback more than once");
        return;
      }
      called = true;

      response.setHeader('Content-Type', 'text/xml');
      if (success) {
        response.end("<Response></Response>");
        return;
      }
      response.end("<Response><Message>Error: " + code + ". " + text +
        " Failed to handle your request.</Message></Response>");
    }
  } else {
    callback = (success, text, code) => {
      if (called) {
        console.error("Calling callback more than once");
        return;
      }
      called = true;

      response.writeHead(code, text, {
        'Content-Length': Buffer.byteLength(text),
        'Content-Type': 'text/plain'
      });
      response.end(text);
    }
  }
  return callback;
}

function buildURL_GET(urlString) {
  var URL_GET = {};
  if (urlString.indexOf('?') == -1) {
    return URL_GET;
  }
  var query = urlString
    .toString()
    // get the query string
    .replace(/^.*?\?/, '')
    // and remove any existing hash string (thanks, @vrijdenker)
    .replace(/#.*$/, '')
    .split('&');
  for (var i = 0, l = query.length; i < l; i++) {
    var aux = decodeURIComponent(query[i]).split('=');
    URL_GET[aux[0]] = aux[1];
  }
  return URL_GET;
}

function strip(phoneNumber) {
  return phoneNumber.replace(/ /g, "").replace(/\(/g, "").replace(/\)/g, "").replace(/\-/g, "");
}

const server = http.createServer(requestHandler);
server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err);
  }
  console.log(`server is listening on ${port}`);
})