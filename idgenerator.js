const emergencyIDLength = 4;
const maxAttempts = 10000; 
// Extremely small likelihood of timing due to infinite loop out unless we are genuinely full.
// We have 36^4 = 1.6 million possible IDs.
const testID = "TEST";
const testDevice = "computer-id";

// No one should ever generate the testID except for testing purposes.
var usedEmergencyID = {testID:true};

var deviceToEmergency = {};
var emergencyToDevice = {};
var emergencyToStage = {};


function makeByDevice(deviceID) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  if (deviceID == testDevice) {
    console.log("Generating the test ID");
    emergencyID = testID;
    deviceToEmergency[deviceID] = emergencyID;
    emergencyToDevice[emergencyID] = deviceID;
    return testID;
  }

<<<<<<< HEAD
  emergencyID = deviceToEmergency[deviceID;]
  if (emergencyID&&emergencyToDevice[emergencyID]) {
=======
  if (deviceToEmergency[deviceID]) {
>>>>>>> aae651f215d7728844fb18e0b36d2f6d2ac52fb4
    throw "Device already has an emergency";
  }

  var emergencyID;
  var called = 0;
  do {
    called += 1;
    emergencyID = "";
    for (var i = 0; i < emergencyIDLength; i++){
      emergencyID += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  } while (usedEmergencyID[emergencyID] && called < maxAttempts);
  
  if (called == maxAttempts) {
    throw "No unused IDs available.";
  }
  
  usedEmergencyID[emergencyID] = true;
  deviceToEmergency[deviceID] = emergencyID;
  emergencyToDevice[emergencyID] = deviceID;
  return emergencyID;
}

function getEmergencyByDevice(deviceID) {
  emergencyID = deviceToEmergency[deviceID];
  if (!emergencyID) {
    throw "Getting undefined ID.";
  }
  return emergencyID;
}

function setStageByEmergency(emergencyID,stage) {
  if (!emergencyToStage[emergencyID]) {
    emergencyToStage[emergencyID] = stage;
    return
  }
  currentStage = emergencyToStage[emergencyID];
  if (currentStage >= stage) {
    throw "Emergency " + emergencyID + " stage is being set out of order. Current stage: " +
     currentStage + ". New Stage: " + stage + ".";
  }
  emergencyToStage[emergencyID] = stage;
}


function endByEmergency(emergencyID) {
  // We don't free up usedEmergencyID because it has already been used and will never be used again.
  deviceID = emergencyToDevice[emergencyID];
  delete emergencyToDevice[emergencyID];
  // We do not delete deviceToEmergency because it might be used by people who want to check up on the status
  // of the emergency after the emergency has ended. 
  delete emergencyToStage[emergencyID];
}

module.exports = {
    makeByDevice,
    getEmergencyByDevice,
    setStageByEmergency,
    endByEmergency
};

