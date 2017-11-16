// content of index.js
const http = require('http');
const port = process.env.PORT || 3000;
const responder = require("./responder.js");
const idGen = require("./idgenerator.js");
const uuidv4 = require('uuid/v4');

const requestHandler = (request, response) => {
  if (request.url.toString() == "") {
    response.end("Welcome to the 2017-doi-app api");
  }
  var result = request.url.toString().split("/");
  if (result.length != 3) {
    response.statusCode = 404;
    response.end("Page not found");
    return;
  }
  URL_GET = buildURL_GET(request.url.toString())

  switch (result[1]) {
    case "latlng":
      prepLatLng(response,URL_GET);
      break;
    case "address":
      prepAddress(response,URL_GET);
      break;
    case "sms":
      prepSMS(response,URL_GET);
    default:
      response.statusCode = 404;
      response.end("Page not found");
  } 
}
function prepLatLng(response,URL_GET) {
  const deviceID = URL_GET["UUID"];
  const latLng = URL_GET["LatLng"];
  if (deviceID == undefined || latLng == undefined) {
    response.statusCode = 400;
    response.end("Invalid request");
    return
  }

  if (idGen.getByDevice(deviceID) != undefined) {
    response.statusCode = 409;
    response.end("This device is already requesting an emergency")
    return
  }
  const emergencyID = idGen.makeByDevice(deviceID);

  const callback = (success) => {
    if (success) {
      response.end("Success")
    } else {
      response.statusCode = 500;
      response.end("Internal server error");
    }
  }
  responder.handleLatLng(emergencyID,latLng,callback);
}

function prepAddress(response,URL_GET) {
  const deviceID = URL_GET["UUID"];
  const zipcode = URL_GET["Zipcode"];
  const rawAddress = URL_GET["Address"];
  if (deviceID == undefined || rawAddress == undefined || zipcode == undefined) {
    response.statusCode = 400;
    response.end("Invalid request");
    return
  }
  const address = rawAddress.replace(/\+/g," ");

  var emergencyID = idGen.getByDevice(deviceID);
  if (emergencyID == undefined) {
    // Our requests came in out of order, so we will just generate this and block the other one
    emergencyID = idGen.makeByDevice(deviceID);
  }

  const callback = (success) => {
    if (success) {
      response.end("Success")
    } else {
      response.statusCode = 500;
      response.end("Internal server error");
    }
  }
  responder.handleAddress(emergencyID,address,zipcode,callback);
}

function prepSMS(response,URL_GET) {
  console.log(URL_GET["Body"]);
  console.log("CALLED");
  response.end("");
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

