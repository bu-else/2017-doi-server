const Dotenv = require('dotenv');
Dotenv.config({ silent: true });

const mapsClient = require('@google/maps').createClient({
    key: process.env.MAPS_KEY
});

const twilioClient = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
);

function handleLatLng(uuid,latLng,callback) {
    mapsClient.reverseGeocode({
            latlng: latLng,
            result_type: ['country', 'street_address'],
            location_type: ['ROOFTOP', 'APPROXIMATE'],
            language: "EN"
        },
        function (err, response) {
            console.log("RETURNED", response.json.results[0])
            if (!err) {
                if (response == "") {
                     callback(false);
                }
                const address = response.json.results[0]["formatted_address"];
                console.log("Address = " + address);
                twilioClient.messages.create({
                    from: process.env.TWILIO_NUMBER,
                    to: process.env.BEN_NUMBER,
                    body: "This text is sent to report an opiate overdose at " + address + ". " + "This is emergency " + uuid +
                    ". This is an anonymous, machine generated text. Please do not reply."
                }).then((messsage) => callback(true))
                    .catch((messsage) => callback(false));

            } else {
                 callback(false);
            }
        }
    )
}

function handleAddress(uuid, address, zipcode, callback) {
    twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: process.env.BEN_NUMBER,
        body: "Emergency " + uuid + " has recieved an updated address: " + address + ". Zipcode: " + zipcode
    }).then((messsage) => callback(true))
        .catch((messsage) => callback(false));
}

module.exports = {
    handleLatLng,
    handleAddress
};
