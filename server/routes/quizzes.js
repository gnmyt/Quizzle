const rateLimit = require('express-rate-limit');
const {validateSchema} = require("../utils/error");
const {quizUpload} = require("../validations/quiz");
const path = require("path");
const fs = require("fs");
const app = require('express').Router();
const {quizzesFolder} = require("../utils/file");
const {generateQuizId} = require("../utils/random");
const {requireAuth} = require("../middleware/auth");
const {compressQuiz} = require("../utils/quiz");
const {resolveQuizPath, writeSavedQuizMeta} = require("../utils/savedQuizzes");

const uploadFile = async (content) => {
    let random = generateQuizId();

    while (await checkIfExists(path.join(quizzesFolder, `${random}.quizzle`))) {
        random = generateQuizId();
    }

    const compressed = compressQuiz({__type: "QUIZZLE2", ...content});

    fs.writeFile(path.join(quizzesFolder, `${random}.quizzle`), compressed, (err) => {
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
    const quizPath = resolveQuizPath(req.params.quizId);

    if (!quizPath) {
        res.status(404).json({message: "Quiz not found"});
        return;
    }

    fs.readFile(quizPath, (err, data) => {
        if (err) {
            res.status(404).json({message: "Quiz not found"});
            return;
        }

        res.send(data);
    });
});

app.put("/", limiter, requireAuth, async (req, res) => {
    if (validateSchema(res, quizUpload, req.body)) return;

    const quizId = await uploadFile(req.body);

    if (req.user?.id) {
        await writeSavedQuizMeta(quizId, {
            owner: req.user.id,
            ownerName: req.user.username,
            created: new Date().toISOString()
        });
    }

    res.json({quizId});
});

module.exports = app;