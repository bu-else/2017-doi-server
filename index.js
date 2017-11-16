// content of index.js
const http = require('http')
const port = process.env.PORT || 3000
const twtest = require("./twtest.js")
const uuidv4 = require('uuid/v4');

const requestHandler = (request, response) => {
  var result = request.url.toString().split("/");
  // if (result.length == 0 || result.length == 1) {
  //   response.end("Invalid request" + request.url);
  //   return
  // }
    var URL_GET = {};
    if(request.url.toString().indexOf('?') !== -1) {
        var query = request.url.toString()
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
    }
  //get the 'index' query parameter

  const args = ["123","14","1555"]
  switch (result[1]) {
    case "first":
      handleFirst(response,args);
      break;
    case "second":
      handleSecond(response,args);
      break;
    case "third":
      console.log(URL_GET["Body"])
      response.setHeader('Content-Type', 'text/xml');
      response.end("<Response></Response>");
  }
}

function handleFirst(response,args) {
  var coord = args.split(",");
  if (coord.length != 2) {
    response.end("Invalid coordinates: " + coord);
    return
  }
  var latLong = [parseFloat(coord[0]),parseFloat(coord[1])];
  const uuid = uuidv4();
  response.end(uuid);
  twtest.handleFirst(latLong,uuid);
}

function handleSecond(response,args) {
  var splits = args.split(",");
  if (splits.length != 3) {
    response.end("Invalid coordinates: " + args);
    return
  }
  const add = splits[0];
  const zip = splits[1];
  const uuid = splits[2];
  response.end("Success");
  twtest.handleSecond(add,zip,uuid);
}

function URL_GET(q,s) { 
    var re = new RegExp('&'+q+'(?:=([^&]*))?(?=&|$)','i'); 
    return (s=s.replace(/^?/,'&').match(re)) ? (typeof s[1] == 'undefined' ? '' : decodeURIComponent(s[1])) : undefined; 
} 

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log(`server is listening on ${port}`)
})

