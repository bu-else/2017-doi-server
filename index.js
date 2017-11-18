// content of index.js
const http = require('http');
const port = process.env.PORT || 3000;
const responder = require("./responder.js");
const idGen = require("./idgenerator.js");
const uuidv4 = require('uuid/v4');


const requestHandler = (request, response) => {
  var result = request.url.toString().split("/");
  if (result.length != 3) {
    response.statusCode = 404;
    response.end("Page not found");
    return;
  }
  URL_GET = buildURL_GET(request.url.toString())

  callback = callbackCreator(response,false)

  switch (result[1]) {
    case "latlng":
      prepLatLng(URL_GET["UUID"], URL_GET["LatLng"],callback);
      break;
    case "address":
      prepAddress(URL_GET["UUID"], URL_GET["Zipcode"], URL_GET["Address"],callback)
      break;
    case "sms":
      prepSMS(response,URL_GET["Body"]);
      break;
    default:
      response.statusCode = 404;
      response.end("Page not found");
  } 
}
function prepLatLng(deviceID,latLng,callback) {
  if (deviceID == undefined || latLng == undefined) {
    callback(false,"Invalid request.",400);
    return
  }

  if (idGen.getByDevice(deviceID) != undefined) {
    response.statusCode = 409;
    callback(false,"This device is already requesting an emergency.",409);
    return
  }
  const emergencyID = idGen.makeByDevice(deviceID);

  responder.handleLatLng(emergencyID,latLng,callback);
}

function prepAddress(deviceID,zipcode,rawAddress,callback) {
  if (deviceID == undefined || rawAddress == undefined || zipcode == undefined) {
    callback(false,"Invalid request.",400);
    return
  }
  const address = rawAddress.replace(/\+/g," ");

  var emergencyID = idGen.getByDevice(deviceID);
  if (emergencyID == undefined) {
    // Our requests came in out of order, so we will just generate this and block the other one
    emergencyID = idGen.makeByDevice(deviceID);
  }

  responder.handleAddress(emergencyID,address,zipcode,callback);
}

function prepSMS(response,body) {
  result = body.split("\n");
  
  callback = callbackCreator(response,true);

  switch (result[0]) {
    case "latlng":
      if (result.length != 3) {
        callback(false,"Invalid request.",400);
        return
      }
      prepLatLng(response,result[1],result[2],callback);
      break;
    case "address":
      if (result.length != 4) {
        callback(false,"Invalid request.",400);
        return
      }
      prepAddress(response,result[1],result[2],result[3],callback)
      break;
    default:
      callback(false,"Request not found.",404);
      break;

  }
}

function callbackCreator(response,isSMS) {
  if (isSMS) {
    const callback = (success, text, code) => {
      response.setHeader('Content-Type', 'text/xml');
      if (success) {
        response.end("<Response></Response>");
        return
      }
      response.end("<Response><Message>Error: " + code + ". " + text + " Failed to handle your request.</Response></Message>");
    }
    return callback;
  } else {
    const callback = (success, text, code) => {
      response.statusCode = code;
      response.end(text);
    }
    return callback
  }
}

function buildURL_GET(urlString){
  var URL_GET = {};
  if(urlString.indexOf('?') == -1) {
    return URL_GET
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
    return console.log('something bad happened', err)
  }
  console.log(`server is listening on ${port}`)
})


