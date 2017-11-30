const Dotenv = require('dotenv');
Dotenv.config({ silent: true });

const mapsClient = require('@google/maps').createClient({
    key: process.env.MAPS_KEY
});

const twilioClient = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
);

var deviceToLocation = {}

function handleLatLng(uuid,latLng,callback) {
    mapsClient.reverseGeocode({
            latlng: latLng,
            result_type: ['country', 'street_address'],
            location_type: ['ROOFTOP', 'APPROXIMATE', "RANGE_INTERPOLATED","APPROXIMATE"],
            language: "EN"
        },
        function (err, response) {
            if (Object.keys(response.json.results).length == 0) {
                console.log("Empty Google Maps response.");
                callback(false,"Internal server error.",500);
                return;
            }
            if (!err) {
                const address = response.json.results[0]["formatted_address"];
                deviceToLocation[uuid] = address;
                console.log("REMOVE THIS");
                callback(true,"Success",200);
                // twilioClient.messages.create({
                //     from: process.env.TWILIO_NUMBER,
                //     to: process.env.BEN_NUMBER,
                //     body: "This text is sent to report an opioid overdose at " + address + ". This is emergency " + uuid +
                //     ". This is an anonymous, machine generated text. Please do not reply."
                // }).then((messsage) => callback(true,"Success.",200))
                //     .catch((messsage) => callback(false,"Internal server error.",500));
            } else {
                console.log(err)
                callback(false,"Internal server error.",500);
            }
        }
    )
}

function handleAddress(uuid, address, zipcode, callback) {
    // Because we are just receiving a street address and a zipcode, without a city, state or country
    // we insert it carefully
    oldAddress = deviceToLocation[uuid];
    formatted = oldAddress.split(",");
    formatted[0] = address;
    formatted[2] = formatted[2].slice(0,4) + zipcode;
    deviceToLocation[uuid] = formatted.join()
    console.log("REMOVE THIS");
    callback(true,"Success",200);
    // twilioClient.messages.create({
    //     from: process.env.TWILIO_NUMBER,
    //     to: process.env.BEN_NUMBER,
    //     body: "Emergency " + uuid + " has recieved an updated address: " + address + ". Zipcode: " + zipcode +
    //     ". This is an anonymous, machine generated text. Please do not reply."
    // }).then((messsage) => callback(true,"Success.",200))
    //     .catch((messsage) => callback(false,"Internal server error.",500));
}

function getAddress(uuid) {
    return deviceToLocation[uuid];
}

function expireAddress(uuid) {
    delete deviceToLocation[uuid];
}

module.exports = {
    handleLatLng,
    handleAddress,
    setAddress,
    getAddress,
    expireAddress
};
