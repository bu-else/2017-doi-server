// content of index.js
const http = require('http');
const port = process.env.PORT || 3000;
const responder = require("./responder.js");
const idGen = require("./idgenerator.js");
const uuidv4 = require('uuid/v4');

const stageLatLng = 1;
const stageAddress = 2;

const requestHandler = (request, response) => {
  if (request.url.toString()=="/") {
    response.end("Wecome to the server of the 2017-doi-app!");
    setTimeout(function(){console.log('After 10 secs')},10000);
  }
  
  callback = callbackCreator(response,false)

  var result = request.url.toString().split("/");
  if (result.length != 3) {
    callback(false,"Page not found.",404);
    return;
  }
  URL_GET = buildURL_GET(request.url.toString())

  switch (result[1]) {
    case "latlng":
      prepLatLng(URL_GET["UUID"], URL_GET["LatLng"],callback);
      break;
    case "address":
      prepAddress(URL_GET["UUID"], URL_GET["Zipcode"], URL_GET["Address"],callback)
      break;
    case "end":
      endEmergency(URL_GET["UUID"],callback);
      break;
    case "sms":
      prepSMS(response,URL_GET["Body"]);
      break;
    default:
      callback(false,"Page not found.",404);
      break;
  } 
}

function prepLatLng(deviceID,latLng,callback) {
  if (deviceID == undefined || latLng == undefined) {
    callback(false,"Invalid request.",400);
    return;
  }

  var emergencyID;
  try  {
    emergencyID = idGen.makeByDevice(deviceID);
    idGen.setStageByDevice(deviceID,stageLatLng);
  }
  catch (e) {
    callback(false,"Internal server error.",500);
    return;
  }

  responder.handleLatLng(emergencyID,latLng,callback);
}

function prepAddress(deviceID,zipcode,rawAddress,callback) {
  if (deviceID == undefined || rawAddress == undefined || zipcode == undefined) {
    callback(false,"Invalid request.",400);
    return;
  }
  const address = rawAddress.replace(/\+/g," ");

  var emergencyID;
  try {
    emergencyID = idGen.getByDevice(deviceID);
    idGen.setStageByDevice(deviceID,stageAddress);
  }
  catch (e) {
    console.log(e);
    callback(false,"Internal server error.",500);
    return;
  }
  responder.handleAddress(emergencyID,address,zipcode,callback);
}

function endEmergency(deviceID,callback) {
   if (deviceID == undefined) {
    callback(false,"Invalid request.",400);
    return;
  }

  try {
    const emergencyID = idGen.getByDevice(deviceID);
    idGen.endByDevice(deviceID);
  } catch (e) {
    console.log(e);
    callback(false,"Internal server error.",500);
    return;
  }

  callback(true,"Success.",200);
}

function prepSMS(response,body) {
  result = body.split("\n");
  
  callback = callbackCreator(response,true);

  switch (result[0]) {
    case "latlng":
      if (result.length != 3) {
        callback(false,"Invalid request.",400);
        return;
      }
      prepLatLng(result[1],result[2],callback);
      break;
    case "address":
      if (result.length != 4) {
        callback(false,"Invalid request.",400);
        return;
      }
      prepAddress(result[1],result[2],result[3],callback)
      break;
    case "end":
      if (result.length != 2) {
        callback(false,"Invalid request.",400);
        return;
      }
      endEmergency(result[1],callback);
    default:
      callback(false,"Request not found.",404);
      break;

  }
}

function callbackCreator(response,isSMS) {
  var called = false;
  if (isSMS) {
    const callback = (success, text, code) => {
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
    return callback;
  } else {
    const callback = (success, text, code) => {
      if (called) {
        console.log("Calling callback more than once");
        return;
      }
      called = true;
      response.statusCode = code;
      response.end(text);
    }
    return callback;
  }
}

function buildURL_GET(urlString){
  var URL_GET = {};
  if(urlString.indexOf('?') == -1) {
    return URL_GET;
  }
  var query = urlString
                 .toString()
                 // get the query string
                 .replace(/^.*?\?/, '')
                 // and remove any existing hash string (thanks, @vrijdenker)
                 .replace(/#.*$/, '')
                 .split('&');
  for(var i=0, l=query.length; i<l; i++) {
     var aux = decodeURIComponent(query[i]).split('=');
     URL_GET[aux[0]] = aux[1];
  }
  return URL_GET;
}

const server = http.createServer(requestHandler);
server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err);
  }
  console.log(`server is listening on ${port}`);
})


