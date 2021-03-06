const co = require("co");
const request = require("co-request");

function assertSuccess(isSuccess,statusCode,testMessage) {
  console.assert(statusCode.toString().startsWith("2") == isSuccess,testMessage)
}

// THIS WILL END YOUR CURRENT EMERGENCY UNDER computer-id. USE CAREFULLY.

co(function* () {
    var url = "http://doi-server.herokuapp.com/end-emergency/?&DeviceID=computer-id"
    var response = yield request(url); 

    url = "http://doi-server.herokuapp.com/start-call/?&DeviceID=computer-id&From=8576361412&LatLng=42.350259,-71.105717" 
    response = yield request(url); 
    assertSuccess(true,response.statusCode,"Starting an emergency");
 
    url = "http://doi-server.herokuapp.com/start-call/?&DeviceID=computer-id&From=8576361412&LatLng=42.350259,-71.105717" 
    response = yield request(url); 
    assertSuccess(false,response.statusCode,"Multiple emergencies per device are not supported");

    url = "http://doi-server.herokuapp.com/update-latlng/?&DeviceID=computer-id&LatLng=42.345616,-71.104136"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Updating latlng");

    url = "http://doi-server.herokuapp.com/update-description/?&DeviceID=computer-id&Description=In%20Apartment%203B%20up%20the%20stairs"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Updating the description");

    url = "http://doi-server.herokuapp.com/dispatch-status/?&DeviceID=computer-id"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Getting dispatch status using DeviceID");
    console.assert(response.body == "Pending", "Expecting pending status")

    url = "http://doi-server.herokuapp.com/fetch-info/?&DeviceID=computer-id"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Fetching the emergency info using DeviceID");
    // TODO: There should be a test to make sure returned info actually matches what we expect, but because this is end to end
    // it is not a good idea.
    // When these are unit tests (which they for sure should be), then this should be fixed.

    url = "http://doi-server.herokuapp.com/sms/?&EmergencyID=TEST&Body=yes+test&From=185763614"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Accepting the emergency over sms");

    url = "http://doi-server.herokuapp.com/end-emergency/?&DeviceID=computer-id"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Ending the emergency using DeviceID");

    url = "http://doi-server.herokuapp.com/dispatch-status/?&DeviceID=computer-id"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Getting dispatch status using DeviceID");
    console.assert(response.body == "Ended", "Expecting ended status")

    url = "http://doi-server.herokuapp.com/start-call/?&DeviceID=computer-id&From=8576361412&LatLng=42.350259,-71.105717" 
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Starting a second emergency once the first has finished");

    url = "http://doi-server.herokuapp.com/dispatch-status/?&DeviceID=computer-id"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Getting dispatch status using EmergencyID");

    url = "http://doi-server.herokuapp.com/fetch-info/?&EmergencyID=TEST"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Fetching the emergency info using EmergencyID");

    url = "http://doi-server.herokuapp.com/sms/?&EmergencyID=TEST&Body=no+test&From=185763614"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Rejecting the emergency over sms");

    url = "http://doi-server.herokuapp.com/end-emergency/?&EmergencyID=TEST"
    response = yield request(url); 
    assertSuccess(true,response.statusCode, "Ending the emergency using EmergencyID");
})