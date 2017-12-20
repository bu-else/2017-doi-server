const http = require('http');
const request = require("request");



const url = "http://doi-server.herokuapp.com/start-call/?&DeviceID=computer-id&From=8576361412&LatLng=42.350259,-71.105717" 
request.get(url, (error, response, body) => {
    console.log(response.status,body);
});