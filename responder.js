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
    console.log("HERE")
    console.log(uuid);
    console.log(latLng);
    mapsClient.reverseGeocode({
            latlng: latLng,
            result_type: ['country', 'street_address'],
            location_type: ['ROOFTOP', 'APPROXIMATE'],
            language: "EN"
        },
        function (err, response) {
            console.log("Got back to me");
            console.log(response.json.results);
            console.log(response.json.results == []);
            console.log(response.json.results == "[]");
            if (!err && response.json.results != []) {
                console.log("CALLED");
                const address = response.json.results[0]["formatted_address"];
                twilioClient.messages.create({
                    from: process.env.TWILIO_NUMBER,
                    to: process.env.BEN_NUMBER,
                    body: "This text is sent to report an opioid overdose at " + address + ". This is emergency " + uuid +
                    ". This is an anonymous, machine generated text. Please do not reply."
                }).then((messsage) => callback(true,"Success.",200))
                    .catch((messsage) => callback(false,"Internal server error.",500));

            } else {
                console.log(response);
                callback(false,"Internal server error.",500);
            }
        }
    )
}

function handleAddress(uuid, address, zipcode, callback) {
    twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: process.env.BEN_NUMBER,
        body: "Emergency " + uuid + " has recieved an updated address: " + address + ". Zipcode: " + zipcode +
        ". This is an anonymous, machine generated text. Please do not reply."
    }).then((messsage) => callback(true,"Success.",200))
        .catch((messsage) => callback(false,"Internal server error.",500));
}

module.exports = {
    handleLatLng,
    handleAddress
};
