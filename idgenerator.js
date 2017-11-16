const emergencyIDLength = 4;
// Extremely small likelihood of timing out unless we are genuinely full
// We have 36^4 = 1.6 million possible IDs
const maxAttempts = 10000; 
var deviceToEmergency = {};
var usedEmergencyID = {};

function makeByDevice(deviceID) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  var genID;
  var called = 0;
  do {
    called += 1;
    genID = "";
    for (var i = 0; i < emergencyIDLength; i++){
      genID += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  } while (usedEmergencyID[genID]!=undefined && called < maxAttempts);
  
  if (called == maxAttempts) {
    return undefined;    
  }
  
  usedEmergencyID[genID] = true;
  deviceToEmergency[deviceID] = genID;
  return genID;
}

function getByDevice(deviceID) {
  return deviceToEmergency[deviceID];
}

function removeByDevice(deviceID) {
  freeID = deviceToEmergency[deviceID];
  delete deviceToEmergency[deviceID];
  delete usedEmergencyID[freeID];
}

module.exports = {
    makeByDevice,
    getByDevice
};