const rateLimit = require('express-rate-limit');
const {validateSchema} = require("../utils/error");
const {quizUpload} = require("../validations/quiz");
const pako = require("pako");
const path = require("path");
const fs = require("fs");
const app = require('express').Router();

const uploadFile = async (content) => {
    let random = Math.random().toString(36).substring(7);

    while (await checkIfExists(path.join(quizzesFolder, `${random}.quizzie`))) {
        random = Math.random().toString(36).substring(7);
    }

    const compressed = pako.deflate(JSON.stringify(content), { to: 'string' });

    fs.writeFile(path.join(quizzesFolder, `${random}.quizzie`), compressed, (err) => {
        if (err) {
            console.error(err);
        }
    });
    return random;
};

const checkIfExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch (err) {
        return false;
    }
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
});

app.get('/:quizId', (req, res) => {
    const escaped = req.params.quizId.replace(/[^a-z0-9]/gi, '');

    fs.readFile(path.join(quizzesFolder, `${escaped}.quizzie`), (err, data) => {
        if (err) {
            res.status(404).json({message: "Quiz not found"});
            return;
        }

        res.send(data);
    });
});

app.put("/", limiter, async (req, res) => {
    if (validateSchema(res, quizUpload, req.body)) return;

    const quizId = await uploadFile(req.body);

    res.json({quizId});
});

module.exports = app;