const Dotenv = require('dotenv');
Dotenv.config({ silent: true });

const mapsClient = require('@google/maps').createClient({
    key: process.env.MAPS_KEY
});

const twilioClient = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
);

var emergencyToAddress = {};
var emergencyToLatLng = {};

function handleLatLng(emergencyID,latLng,callback) {
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
                emergencyToAddress[emergencyID] = address;
                emergencyToLatLng[emergencyID] = latLng;
                twilioClient.messages.create({
                    from: process.env.TWILIO_NUMBER,
                    to: process.env.BEN_NUMBER,
                    body: "This text is sent to report an opioid overdose at " + address + ". This is emergency " + emergencyID +
                    ". This is an anonymous, machine generated text. Please do not reply."
                }).then((messsage) => callback(true,"Success.",200))
                    .catch((messsage) => callback(false,"Internal server error.",500));
            } else {
                console.log(err)
                callback(false,"Internal server error.",500);
            }
        }
    )
}

function handleAddress(emergencyID, address, zipcode, callback) {
    // Because we are just receiving a street address and a zipcode, without a city, state or country
    // we insert it carefully
    oldAddress = emergencyToAddress[emergencyID];
    formatted = oldAddress.split(",");
    formatted[0] = address;
    formatted[2] = formatted[2].slice(0,4) + zipcode;
    emergencyToAddress[emergencyID] = formatted.join()
    twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: process.env.BEN_NUMBER,
        body: "Emergency " + emergencyID + " has recieved an updated address: " + address + ". Zipcode: " + zipcode +
        ". This is an anonymous, machine generated text. Please do not reply."
    }).then((messsage) => callback(true,"Success.",200))
        .catch((messsage) => callback(false,"Internal server error.",500));
}

function getLocationJSON(emergencyID) {
    const address = emergencyToAddress[emergencyID];
    const latLng = emergencyToLatLng[emergencyID];
    if (!address || !latLng) {
        return undefined
    }
    return JSON.stringify({"address":address,"latLng":latLng})
}

function expireLocation(emergencyID) {
    delete emergencyToAddress[emergencyID];
    delete emergencyToLatLng[emergencyID];
}

module.exports = {
    handleLatLng,
    handleAddress,
    getLocationJSON,
    expireLocation
};
