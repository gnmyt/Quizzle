const rateLimit = require('express-rate-limit');
const {validateSchema} = require("../utils/error");
const {quizUpload} = require("../validations/quiz");
const pako = require("pako");
const path = require("path");
const fs = require("fs");
const app = require('express').Router();
const {quizzesFolder} = require("../utils/file");
const {generateQuizId} = require("../utils/random");

const uploadFile = async (content) => {
    let random = generateQuizId();

    while (await checkIfExists(path.join(quizzesFolder, `${random}.quizzle`))) {
        random = generateQuizId();
    }

    const compressed = pako.deflate(JSON.stringify({__type: "QUIZZLE1", ...content}), { to: 'string' });

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

const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { message: "Too many password attempts" }
});

app.get('/:quizId', (req, res) => {
    const escaped = req.params.quizId.replace(/[^a-z0-9]/gi, '');

    fs.readFile(path.join(quizzesFolder, `${escaped}.quizzle`), (err, data) => {
        if (err) {
            res.status(404).json({message: "Quiz not found"});
            return;
        }

        res.send(data);
    });
});

app.post("/validate-password", passwordLimiter, (req, res) => {
    const { password } = req.body;
    const correctPassword = process.env.PASSWORD_PROTECTION;
    
    if (!correctPassword) {
        return res.status(400).json({ message: "Password protection not enabled" });
    }
    
    if (!password) {
        return res.status(400).json({ message: "Password is required" });
    }
    
    if (password === correctPassword) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false, message: "Invalid password" });
    }
});

app.put("/", limiter, async (req, res) => {
    if (validateSchema(res, quizUpload, req.body)) return;

    const passwordProtection = process.env.PASSWORD_PROTECTION;
    if (passwordProtection) {
        const password = req.headers['x-quiz-password'];
        
        if (!password) {
            return res.status(401).json({ message: "Password is required" });
        }
        
        if (password !== passwordProtection) {
            return res.status(401).json({ message: "Invalid password" });
        }
    }

    const quizId = await uploadFile(req.body);
    res.json({quizId});
});

module.exports = app;