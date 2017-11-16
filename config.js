'use strict';
const Confidence = require('confidence');
const Dotenv = require('dotenv');


Dotenv.config({ silent: true });

const criteria = {
    env: process.env.NODE_ENV
};


const config = {
    $meta: 'This file configures the plot device.',
    projectName: 'Frame',
    mapsKey: process.env.MAPS_KEY,
    twilio: {
        SID:process.env.TWILIO_SID,
        token:process.env.TWILIO_TOKEN,
    },
    twilioNum: process.env.TWILIO_NUMBER,
    benNum: process.env.BEN_NUMBER,
    mikeNum: process.env.MIKE_NUMBER,
};


const store = new Confidence.Store(config);


exports.get = function (key) {
    return store["_tree"][key];
};


exports.meta = function (key) {

    return store.meta(key, criteria);
};