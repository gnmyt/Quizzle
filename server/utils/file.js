const fs = require("fs");
const path = require("path");
const {validateSchema} = require("./error");
const {brandingConfig} = require("../validations/brandingConfig");

const dataFolder = path.join(process.cwd(), 'data');
const quizzesFolder = path.join(dataFolder, 'quizzes');
const brandingFolder = path.join(dataFolder, 'branding');

const createFolders = () => {
    if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
    if (!fs.existsSync(quizzesFolder)) fs.mkdirSync(quizzesFolder);
    if (!fs.existsSync(brandingFolder)) fs.mkdirSync(brandingFolder);
}

const createFiles = () => {
    if (!fs.existsSync(path.join(brandingFolder, "logo.png"))) {
        fs.copyFileSync(path.join(process.cwd(), "content", "logo.png"), path.join(brandingFolder, "logo.png"));
    }

    if (!fs.existsSync(path.join(brandingFolder, "title.png"))) {
        fs.copyFileSync(path.join(process.cwd(), "content", "title.png"), path.join(brandingFolder, "title.png"));
    }

    if (!fs.existsSync(path.join(brandingFolder, "branding.json"))) {
        fs.copyFileSync(path.join(process.cwd(), "content", "branding.json"), path.join(brandingFolder, "branding.json"));
    }
}

module.exports.firstStart = () => {
    createFolders();
    createFiles();

    const error = validateSchema(null, brandingConfig, require(path.join(brandingFolder, "branding.json")));

    if (error) {
        console.error("Invalid branding.json file: " + error.message);
        process.exit(1);
    }
}

module.exports.dataFolder = dataFolder;
module.exports.quizzesFolder = quizzesFolder;
module.exports.brandingFolder = brandingFolder;