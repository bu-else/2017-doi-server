class Tester {
  constructor(twilioClient, reverseGeocode) {
    this.twilioClient = twilioClient;
    this.reverseGeocode = reverseGeocode;
    this.food = "FOOD";
  }

  handleLatLng(callback) {
    console.log(this.reverseGeocode(0));
    console.log(this.food);
    callback(true);
  }
}

function testReverseGeocode(options) {
  return {
    json: {
      results: [{
        formatted_address: "725 Commonwealth Avenue, Boston, MA 02215"
      }]
    }
  };
}

function testCallbackFactory(shouldBeSuccess) {
  const expectedResult = shouldBeSuccess ? "successful callback" : "failure";
  const gotResult = shouldBeSuccess ? "failure" : "successful callback";
  const callback = (success, text, code) => {
      console.assert(success==shouldBeSuccess, "Expected a " + expectedResult + " but got a " + gotResult + " instead.");
  }
  return callback
}


test = new Tester(10, testReverseGeocode);
test.handleLatLng(testCallbackFactory(true));
