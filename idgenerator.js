const emergencyIDLength = 4;
const maxAttempts = 10000; 
// Extremely small likelihood of timing due to infinite loop out unless we are genuinely full.
// We have 36^4 = 1.6 million possible IDs.
const testID = "TEST";

var deviceToEmergency = {};
var usedEmergencyID = {testID:true};
// No one should ever generate the testID except for testing purposes.
var deviceToStage = {};

function makeByDevice(deviceID) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  if (deviceID == "computer-id") {
    console.log("Generating the test ID");
    deviceToEmergency[deviceID] = testID;
    return testID;
  }

  var genID;
  var called = 0;
  do {
    called += 1;
    genID = "";
    for (var i = 0; i < emergencyIDLength; i++){
      genID += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  } while (usedEmergencyID[genID] && called < maxAttempts);
  
  if (called == maxAttempts) {
    throw "No unused IDs available.";
  }
  
  usedEmergencyID[genID] = true;
  deviceToEmergency[deviceID] = genID;
  return genID;
}

function getByDevice(deviceID) {
  emergency = deviceToEmergency[deviceID];
  if (!emergency) {
    throw "Getting undefined ID.";
  }
  return emergency;
}

function setStageByDevice(deviceID,stage) {
  if (!deviceToStage[deviceID]) {
    deviceToStage[deviceID] = stage;
    return
  }
  currentStage = deviceToStage[deviceID];
  if (currentStage >= stage) {
    throw "Device ID: " + deviceID + "\'s stage is being set out of order. Current stage: " +
     currentStage + ". New Stage: " + stage + ".";
  }
  deviceToStage[deviceID] = stage;
}

function endByDevice(deviceID) {
  // We don't free up usedEmergencyID because it has already been used
  delete deviceToEmergency[deviceID];
  delete deviceToStage[deviceID];
}

module.exports = {
    makeByDevice,
    getByDevice,
    setStageByDevice,
    endByDevice
};

