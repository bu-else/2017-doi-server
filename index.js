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

const stageLatLng = 1;
const stageAddress = 2;

// If expirationTime is set to -1, requests will never expire
// Otherwise, a good value is ten minutes
const minute = 60 * 1000;
const expirationTime = -1;

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
    case "latlng":
      success = prepLatLng(URL_GET["deviceID"], URL_GET["LatLng"], undefined, false, callback);
      break;

    case "address":
      prepAddress(URL_GET["deviceID"], URL_GET["Zipcode"], URL_GET["Address"], callback);
      break;

    case "end":
      endEmergency(URL_GET["deviceID"], URL_GET["emergencyID"], callback);
      break;

    case "dispatch":
      getDispatch(URL_GET["deviceID"],response,callback);
      break;

    case "fetch":
      fetchAddress(URL_GET["deviceID"], URL_GET["emergencyID"], response, callback);
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
  if (strip(phoneNumber) == strip(process.env.BEN_NUMBER) && firstLine.length >= 2) {
    if (firstLine.length != 3) {
        callback(false, "Invalid request.", 400);
        return;
    }

    switch (firstLine[0].toLowerCase()) {
      case "yes":
        responder.acceptDispatch(firstLine[1].toUpperCase(),true,callback);
        break;
      case "no":
        responder.acceptDispatch(firstLine[1].toUpperCase(),false,callback);
        endEmergency(undefined,firstLine[1].toUpperCase(),callback);
        break;
      default:
        callback(false, "Request not found.", 404);
        break;
    }
    return;
  }

  switch (result[0]) {
    case "latlng":
      if (result.length != 3) {
        callback(false, "Invalid request.", 400);
        return;
      }
      success = prepLatLng(result[1], result[2], phoneNumber, true, callback);
      break;

    case "address":
      if (result.length != 4) {
        callback(false, "Invalid request.", 400);
        return;
      }
      prepAddress(result[1], result[2], result[3], callback);
      break;

    case "end":
      if (result.length != 2) {
        callback(false, "Invalid request.", 400);
        return;
      }
      endEmergency(result[1], undefined, callback);
      break;

    default:
      callback(false, "Request not found.", 404);
      break;
  }
}

function prepLatLng(deviceID, latLng, phoneNumber, isSMS, callback) {
  if (!deviceID || !latLng || (!phoneNumber && isSMS)) {
    callback(false, "Invalid request.", 400);
    return false;
  }

  var emergencyID;
  try {
    emergencyID = idGen.makeByDevice(deviceID);
    idGen.setStageByEmergency(emergencyID, stageLatLng);
  } catch (e) {
    console.log(e);
    callback(false, "Internal server error.", 500);
    return false;
  }

  responder.prepareDispatch(emergencyID,phoneNumber,isSMS);
  responder.handleLatLng(emergencyID, latLng, callback);

  // As mentioned above, just change expiration time to -1 to never expire emergencies
  if (expirationTime == -1) {
    console.log("Not expiring addresses.");
    return true;
  }
  setTimeout(function() {
    endByEmergency(emergencyID, function(s, t, c) {
      console.log("Emergency " + emergencyID + " timed out.");
      console.log("Result of timeout was: ", s, t, c);
    });
  }, expirationTime);
  return true;
}

function prepAddress(deviceID, zipcode, rawAddress, callback) {
  if (!deviceID || !rawAddress || !zipcode) {
    callback(false, "Invalid request.", 400);
    return;
  }
  const address = rawAddress.replace(/\+/g, " ");


  const emergencyID = tryGetEmergencyID(deviceID, callback);
  if (!emergencyID) {
    return;
  }

  try {
    idGen.setStageByEmergency(emergencyID, stageAddress);
  } catch (e) {
    console.log(e);
    callback(false, "Internal server error.", 500);
    return;
  }

  responder.handleAddress(emergencyID, address, zipcode, callback);

}

function getDispatch(deviceID,response,callback) {
  if (!deviceID) {
    callback(false, "Invalid request.", 400);
    return;
  }

  emergencyID = tryGetEmergencyID(deviceID, callback);
  if (!emergencyID) {
    return;
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
    callback(false, "Location not found.", 500);
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(json);
}

function endEmergency(deviceID, emergencyID, callback) {
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

  try {
    idGen.endByEmergency(emergencyID);
    responder.expireLocation(emergencyID);
  } catch (e) {
    console.log(e);
    callback(false, "Internal server error.", 500);
    return;
  }

  callback(true, "Success.", 200);
}

function tryGetEmergencyID(deviceID, callback) {
  var emergencyID;
  try {
    emergencyID = idGen.getEmergencyByDevice(deviceID);
  } catch (e) {
    console.log(e);
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
        console.log("Calling callback more than once");
        return;
      }
      called = true;

      response.setHeader('Content-Type', 'text/xml');
      if (success) {
        response.end("<Response></Response>");
        return;
      }
      response.end("<Response><Message>Error: " + code + ". " + text + " Failed to handle your request.</Message></Response>");
    }
  } else {
    callback = (success, text, code) => {
      if (called) {
        console.log("Calling callback more than once");
        return;
      }
      called = true;

      response.statusCode = code;
      if (!success) {
        response.statusMessage = text;
      }
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