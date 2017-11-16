const Dotenv = require('dotenv');
Dotenv.config({ silent: true });

const mapsClient = require('@google/maps').createClient({
    key: process.env.MAPS_KEY
});

const twilioClient = require('twilio')(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
);

function handleFirst(latLng, uuid) {
    console.log(latLng);
    mapsClient.reverseGeocode({
            latlng: latLng,
            result_type: ['country', 'street_address'],
            location_type: ['ROOFTOP', 'APPROXIMATE'],
            language: "EN"
        },
        function (err, response) {
            console.log("RETURNED", response.json.results[0])
            if (!err) {
                console.log(response);
                const address = response.json.results[0]["formatted_address"];
                console.log("Address = " + address);
                twilioClient.messages.create({
                    from: process.env.TWILIO_NUMBER,
                    to: process.env.BEN_NUMBER,
                    body: "This text is sent to report an opiate overdose at " + address + ". " + "This is emergency " + uuid +
                    ". This is an anonymous, machine generated text. Please do not reply."
                }).then((messsage) => console.log(message.sid))
                    .catch((messsage) => console.log(message.sid));

            } else {
                console.log("ERROR: " + err);
            }
        }
    )
}

function handleSecond(address, zipcode, uuid) {
    twilioClient.messages.create({
        from: process.env.TWILIO_NUMBER,
        to: process.env.BEN_NUMBER,
        body: "Emergency " + uuid + " has recieved an updated address: " + address + ". Zipcode: " + zipcode
    }).then((messsage) => console.log(message.sid))
        .catch((messsage) => console.log(message.sid));
}

module.exports = {
    handleFirst,
    handleSecond
};
