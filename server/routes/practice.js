const rateLimit = require('express-rate-limit');
const {validateSchema} = require("../utils/error");
const {quizUpload} = require("../validations/quiz");
const pako = require("pako");
const path = require("path");
const fs = require("fs").promises;
const {generatePracticeCode, isAlphabeticCode} = require("../utils/random");
const app = require('express').Router();

const practiceQuizzesDir = path.join(__dirname, '../../data/practice-quizzes');

const ensurePracticeQuizzesDir = async () => {
    try {
        await fs.access(practiceQuizzesDir);
    } catch {
        await fs.mkdir(practiceQuizzesDir, {recursive: true});
    }
};

const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
});

const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: {message: "Too many password attempts"}
});

const practiceQuizExists = async (code) => {
    try {
        const quizPath = path.join(practiceQuizzesDir, code);
        await fs.access(quizPath);
        return true;
    } catch {
        return false;
    }
};

const isPracticeQuizExpired = async (code) => {
    try {
        const metaPath = path.join(practiceQuizzesDir, code, 'meta.json');
        const metaContent = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaContent);
        return new Date(meta.expiry) < new Date();
    } catch {
        return true;
    }
};

app.put("/", createLimiter, async (req, res) => {
    try {
        if (validateSchema(res, quizUpload, req.body)) return;

        const {password} = req.headers;
        const correctPassword = process.env.PASSWORD_PROTECTION;

        if (!correctPassword) {
            return res.status(400).json({message: "Teacher password not configured"});
        }

        if (!password) {
            return res.status(400).json({message: "Teacher password is required for practice quizzes"});
        }

        if (password !== correctPassword) {
            return res.status(401).json({message: "Invalid teacher password"});
        }

        await ensurePracticeQuizzesDir();

        let practiceCode = generatePracticeCode();
        while (await practiceQuizExists(practiceCode)) {
            practiceCode = generatePracticeCode();
        }

        const quizDir = path.join(practiceQuizzesDir, practiceCode);
        const resultsDir = path.join(quizDir, 'results');

        await fs.mkdir(quizDir, {recursive: true});
        await fs.mkdir(resultsDir, {recursive: true});

        const compressed = pako.deflate(JSON.stringify({__type: "QUIZZLE2", ...req.body}), {to: 'string'});
        await fs.writeFile(path.join(quizDir, 'quiz.quizzle'), compressed);

        const now = new Date();
        const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const meta = {
            created: now.toISOString(),
            expiry: expiry.toISOString()
        };

        await fs.writeFile(path.join(quizDir, 'meta.json'), JSON.stringify(meta, null, 2));

        res.json({practiceCode});
    } catch (error) {
        console.error('Error creating practice quiz:', error);
        res.status(500).json({message: "Error creating practice quiz"});
    }
});

app.get('/:code', async (req, res) => {
    try {
        const code = req.params.code.replace(/[^A-Z]/gi, '').toUpperCase();

        if (!isAlphabeticCode(code)) {
            return res.status(400).json({message: "Invalid practice code format"});
        }

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: "Practice quiz not found"});
        }

        if (await isPracticeQuizExpired(code)) {
            return res.status(410).json({message: "Practice quiz has expired"});
        }

        const quizPath = path.join(practiceQuizzesDir, code, 'quiz.quizzle');
        const quizData = await fs.readFile(quizPath);

        const decompressed = pako.inflate(quizData, {to: 'string'});
        const quiz = JSON.parse(decompressed);

        const practiceQuiz = {
            ...quiz,
            questions: quiz.questions.map(question => {
                const practiceQuestion = {...question};

                if (question.type === 'text') {
                    practiceQuestion.answers = [];
                } else {
                    practiceQuestion.answers = question.answers.map(answer => ({
                        content: answer.content
                    }));
                }

                return practiceQuestion;
            })
        };

        res.json(practiceQuiz);
    } catch (error) {
        console.error('Error loading practice quiz:', error);
        res.status(500).json({message: "Error loading practice quiz"});
    }
});

app.post('/:code/submit-answer', async (req, res) => {
    try {
        const code = req.params.code.replace(/[^A-Z]/gi, '').toUpperCase();
        const {attemptId, questionIndex, answer, name, character} = req.body;

        if (!isAlphabeticCode(code)) {
            return res.status(400).json({message: "Invalid practice code format"});
        }

        if (!attemptId || questionIndex === undefined || answer === undefined) {
            return res.status(400).json({message: "Attempt ID, question index and answer are required"});
        }

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: "Practice quiz not found"});
        }

        if (await isPracticeQuizExpired(code)) {
            return res.status(410).json({message: "Practice quiz has expired"});
        }

        const quizPath = path.join(practiceQuizzesDir, code, 'quiz.quizzle');
        const quizData = await fs.readFile(quizPath);
        const decompressed = pako.inflate(quizData, {to: 'string'});
        const quiz = JSON.parse(decompressed);

        const question = quiz.questions[questionIndex];
        if (!question) {
            return res.status(400).json({message: "Invalid question index"});
        }

        let answerResult = 'incorrect';
        let correctAnswer = null;

        if (question.type === 'text') {
            const isCorrect = question.answers.some(acceptedAnswer =>
                acceptedAnswer.content.toLowerCase().trim() === answer.toLowerCase().trim()
            );
            answerResult = isCorrect ? 'correct' : 'incorrect';
            correctAnswer = question.answers[0]?.content;
        } else {
            if (Array.isArray(answer)) {
                const correctIndices = question.answers
                    .map((ans, idx) => ans.is_correct ? idx : -1)
                    .filter(idx => idx !== -1);

                const selectedCorrect = answer.filter(idx => correctIndices.includes(idx));
                const selectedIncorrect = answer.filter(idx => !correctIndices.includes(idx));

                if (selectedCorrect.length === correctIndices.length && selectedIncorrect.length === 0) {
                    answerResult = 'correct';
                } else if (selectedCorrect.length > 0) {
                    answerResult = 'partial';
                } else {
                    answerResult = 'incorrect';
                }

                correctAnswer = correctIndices;
            } else {
                const isCorrect = question.answers[answer]?.is_correct || false;
                answerResult = isCorrect ? 'correct' : 'incorrect';
                correctAnswer = question.answers
                    .map((ans, idx) => ans.is_correct ? idx : -1)
                    .filter(idx => idx !== -1);
            }
        }

        const resultsDir = path.join(practiceQuizzesDir, code, 'results');
        await fs.mkdir(resultsDir, {recursive: true});
        const resultPath = path.join(resultsDir, `${attemptId}.json`);

        let result = {
            name: name || 'Anonymous',
            character: character || 'wizard',
            answers: [],
            score: 0,
            total: quiz.questions.length,
            timestamp: new Date().toISOString()
        };

        try {
            const existingResult = await fs.readFile(resultPath, 'utf8');
            result = JSON.parse(existingResult);
        } catch {
        }

        if (result.answers.length > questionIndex) {
            return res.status(400).json({message: "Cannot modify previous answers"});
        }

        if (result.answers.length !== questionIndex) {
            return res.status(400).json({message: "Must answer questions in order"});
        }

        result.answers.push({
            result: answerResult, userAnswer: answer,
            correctAnswer: correctAnswer
        });

        result.score = result.answers.filter(a => a.result === 'correct').length;

        result.timestamp = new Date().toISOString();

        await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

        const isLastQuestion = questionIndex === quiz.questions.length - 1;
        let finalResults = null;

        if (isLastQuestion) {
            finalResults = {
                score: result.score,
                total: quiz.questions.length,
                results: result.answers
            };
        }

        res.json({
            result: answerResult, isLastQuestion,
            finalResults
        });
    } catch (error) {
        console.error('Error submitting practice answer:', error);
        res.status(500).json({message: "Error submitting practice answer"});
    }
});

app.post('/:code/results', passwordLimiter, async (req, res) => {
    try {
        const code = req.params.code.replace(/[^A-Z]/gi, '').toUpperCase();
        const {password} = req.body;

        if (!isAlphabeticCode(code)) {
            return res.status(400).json({message: "Invalid practice code format"});
        }

        if (!password) {
            return res.status(400).json({message: "Password is required"});
        }

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: "Practice quiz not found"});
        }

        const metaPath = path.join(practiceQuizzesDir, code, 'meta.json');
        const metaContent = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaContent);

        const correctPassword = process.env.PASSWORD_PROTECTION;
        if (!correctPassword) {
            return res.status(500).json({message: "Teacher password not configured"});
        }

        if (password !== correctPassword) {
            return res.status(401).json({message: "Invalid teacher password"});
        }

        const resultsDir = path.join(practiceQuizzesDir, code, 'results');
        const resultFiles = await fs.readdir(resultsDir);

        const results = [];
        for (const file of resultFiles) {
            if (file.endsWith('.json')) {
                const resultContent = await fs.readFile(path.join(resultsDir, file), 'utf8');
                results.push(JSON.parse(resultContent));
            }
        }

        const totalAttempts = results.length;
        const averageScore = totalAttempts > 0
            ? results.reduce((sum, result) => sum + result.score, 0) / totalAttempts
            : 0;
        const maxScore = results.length > 0 ? Math.max(...results.map(r => r.score)) : 0;
        const minScore = results.length > 0 ? Math.min(...results.map(r => r.score)) : 0;

        const studentResults = {};
        results.forEach(result => {
            if (!studentResults[result.name]) {
                studentResults[result.name] = [];
            }
            studentResults[result.name].push(result);
        });

        const quizPath = path.join(practiceQuizzesDir, code, 'quiz.quizzle');
        const quizData = await fs.readFile(quizPath);
        const decompressed = pako.inflate(quizData, {to: 'string'});
        const quiz = JSON.parse(decompressed);

        res.json({
            meta: {
                created: meta.created,
                expiry: meta.expiry,
                totalAttempts,
                averageScore: Math.round(averageScore * 100) / 100,
                maxScore,
                minScore
            },
            results: results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            studentResults,
            quiz: quiz
        });
    } catch (error) {
        console.error('Error viewing practice quiz results:', error);
        res.status(500).json({message: "Error viewing practice quiz results"});
    }
});


module.exports = app;
