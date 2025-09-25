const app = require('express').Router();
const fs = require('fs');
const path = require('path');
const {brandingFolder} = require("../utils/file");

const readBranding = (fileName) => {
    const file = fs.readFileSync(path.join(brandingFolder, fileName));
    return Buffer.from(file).toString('base64');
}

const logoPayload = readBranding("logo.png");
const titlePayload = readBranding("title.png");
const brandingPayload = require(path.join(brandingFolder, "branding.json"));

app.get('/', (req, res) => {
    res.json({
        logo: logoPayload, 
        title: titlePayload, 
        ...brandingPayload,
        passwordProtected: !!process.env.PASSWORD_PROTECTION
    });
});

module.exports = app;