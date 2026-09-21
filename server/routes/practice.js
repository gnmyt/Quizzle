const rateLimit = require('express-rate-limit');
const {validateSchema} = require("../utils/error");
const {practiceUpload} = require("../validations/quiz");
const path = require("path");
const fs = require("fs").promises;
const {generatePracticeCode, isAlphabeticCode} = require("../utils/random");
const app = require('express').Router();
const {requireAuth} = require("../middleware/auth");
const {compressQuiz, resolveQuestionType, shuffleSequenceAnswers, stripAnswerCorrectness} = require("../utils/quiz");
const {evaluateTextAnswer, evaluateSequenceAnswer, evaluateChoiceAnswer, evaluateSliderAnswer} = require("../utils/scoring");
const {canManage} = require("../utils/ownership");
const {
    normalizePracticeCode,
    isSafePracticeCode,
    resolvePracticeDir,
    practiceQuizExists,
    loadPracticeQuiz,
    readPracticeMeta,
    readPracticeResults,
    writePracticeMeta,
    isPracticeExpired,
} = require("../utils/practice");

const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
});

const isPracticeQuizExpired = async (code) => isPracticeExpired(await readPracticeMeta(code));

const validatePracticeCode = async (code, res) => {
    if (!isAlphabeticCode(code)) {
        res.status(400).json({message: "Invalid practice code format"});
        return false;
    }
    if (!await practiceQuizExists(code)) {
        res.status(404).json({message: "Practice quiz not found"});
        return false;
    }
    if (await isPracticeQuizExpired(code)) {
        res.status(410).json({message: "Practice quiz has expired"});
        return false;
    }
    return true;
};

app.put("/", createLimiter, requireAuth, async (req, res) => {
    try {
        if (validateSchema(res, practiceUpload, req.body)) return;

        const {expiry, ...quizPayload} = req.body;

        let practiceCode = generatePracticeCode();
        while (await practiceQuizExists(practiceCode)) {
            practiceCode = generatePracticeCode();
        }

        const quizDir = resolvePracticeDir(practiceCode);
        const resultsDir = path.join(quizDir, 'results');

        await fs.mkdir(quizDir, {recursive: true});
        await fs.mkdir(resultsDir, {recursive: true});

        const compressed = compressQuiz({__type: "QUIZZLE2", ...quizPayload});
        await fs.writeFile(path.join(quizDir, 'quiz.quizzle'), compressed);

        const meta = {
            created: new Date().toISOString(),
            expiry: expiry ? new Date(expiry).toISOString() : null,
            owner: req.user?.id || null,
            ownerName: req.user?.username || null
        };

        await writePracticeMeta(practiceCode, meta);

        res.json({practiceCode, expiry: meta.expiry});
    } catch (error) {
        console.error('Error creating practice quiz:', error);
        res.status(500).json({message: "Error creating practice quiz"});
    }
});

app.get('/:code/exists', async (req, res) => {
    try {
        const code = normalizePracticeCode(req.params.code);

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({exists: false, message: "Invalid practice code format"});
        }

        const exists = await practiceQuizExists(code);
        if (!exists) {
            return res.status(404).json({exists: false, message: "Practice quiz not found"});
        }

        const expired = await isPracticeQuizExpired(code);
        if (expired) {
            return res.status(410).json({exists: false, message: "Practice quiz has expired"});
        }

        res.json({exists: true});
    } catch (error) {
        console.error('Error checking practice quiz existence:', error);
        res.status(500).json({exists: false, message: "Error checking practice quiz"});
    }
});

app.get('/:code', async (req, res) => {
    try {
        const code = normalizePracticeCode(req.params.code);
        if (!await validatePracticeCode(code, res)) return;

        const quiz = await loadPracticeQuiz(code);

        const practiceQuiz = {
            ...quiz,
            questions: quiz.questions.map(question => {
                const practiceQuestion = {...question};

                if (question.type === 'text') {
                    practiceQuestion.answers = [];
                } else if (question.type === 'slider') {
                    const config = question.answers[0];
                    practiceQuestion.answers = [{
                        min: config.min,
                        max: config.max,
                        step: config.step || 1
                    }];
                    practiceQuestion.sliderConfig = {
                        min: config.min,
                        max: config.max,
                        step: config.step || 1
                    };
                } else if (question.type === 'sequence') {
                    practiceQuestion.answers = shuffleSequenceAnswers(
                        question.answers.map(a => ({content: a.content, type: a.type || 'text'}))
                    );
                } else {
                    practiceQuestion.answers = stripAnswerCorrectness(question.answers);
                    practiceQuestion.type = resolveQuestionType(question.type, question.answers);
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
        const code = normalizePracticeCode(req.params.code);
        const {attemptId, questionIndex, answer, name, character} = req.body;

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({message: "Invalid practice code format"});
        }

        if (!attemptId || questionIndex === undefined || answer === undefined) {
            return res.status(400).json({message: "Attempt ID, question index and answer are required"});
        }

        if (!await validatePracticeCode(code, res)) return;

        const quiz = await loadPracticeQuiz(code);
        const question = quiz.questions[questionIndex];
        if (!question) {
            return res.status(400).json({message: "Invalid question index"});
        }

        let answerResult;
        let correctAnswer;
        let normalizedAnswer = answer;
        let answerScore = 0;

        if (question.type === 'text') {
            answerResult = evaluateTextAnswer(answer, question.answers) ? 'correct' : 'incorrect';
            correctAnswer = question.answers[0]?.content;
            answerScore = answerResult === 'correct' ? 1 : 0;
        } else if (question.type === 'slider') {
            const sliderAnswer = Number(answer);
            if (!Number.isFinite(sliderAnswer)) {
                return res.status(400).json({message: "Slider answer must be a number"});
            }

            const sliderResult = evaluateSliderAnswer(sliderAnswer, question);
            if (sliderResult.isCorrect && sliderResult.score >= 0.9) answerResult = 'correct';
            else if (sliderResult.isCorrect) answerResult = 'partial';
            else answerResult = 'incorrect';

            correctAnswer = {
                correctValue: question.answers[0]?.correctValue,
                min: question.answers[0]?.min,
                max: question.answers[0]?.max,
                answerMargin: question.answers[0]?.answerMargin || 'medium'
            };
            normalizedAnswer = sliderAnswer;
            answerScore = sliderResult.score;
        } else if (question.type === 'sequence') {
            const seqResult = evaluateSequenceAnswer(answer, question);
            if (seqResult.isCorrect) answerResult = 'correct';
            else if (seqResult.isPartial) answerResult = 'partial';
            else answerResult = 'incorrect';
            correctAnswer = question.answers.map(a => a.content);
            answerScore = answerResult === 'correct' ? 1 : answerResult === 'partial' ? 0.5 : 0;
        } else {
            const choiceResult = evaluateChoiceAnswer(answer, question.answers);
            answerResult = choiceResult.result;
            correctAnswer = choiceResult.correctIndices;
            answerScore = answerResult === 'correct' ? 1 : answerResult === 'partial' ? 0.5 : 0;
        }

        const resultsDir = path.join(resolvePracticeDir(code), 'results');
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
            result: answerResult,
            userAnswer: normalizedAnswer,
            correctAnswer,
            score: Math.round(answerScore * 1000) / 1000
        });

        result.score = Math.round(result.answers.reduce((sum, entry) => sum + (entry.score || 0), 0) * 100) / 100;

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
        res.status(500).json({message: "Error submitting answer"});
    }
});

const generatePracticeAnalytics = (quiz, results, studentResults, averageScore, totalAttempts) => {
    const totalStudents = Object.keys(studentResults).length;
    const totalQuestions = quiz.questions.length;

    const questionAnalytics = quiz.questions.map((question, questionIndex) => {
        let correctCount = 0;
        let partialCount = 0;
        let incorrectCount = 0;
        let totalResponses = 0;

        results.forEach(result => {
            if (result.answers && result.answers[questionIndex]) {
                totalResponses++;
                const answerResult = result.answers[questionIndex].result;
                if (answerResult === 'correct') correctCount++;
                else if (answerResult === 'partial') partialCount++;
                else incorrectCount++;
            }
        });

        const correctPercentage = totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;

        return {
            questionIndex,
            title: question.title,
            type: question.type,
            totalResponses,
            correctCount,
            partialCount,
            incorrectCount,
            correctPercentage,
            difficulty: correctPercentage >= 80 ? 'easy' : correctPercentage >= 60 ? 'medium' : 'hard',
            needsReview: correctPercentage < 60
        };
    });

    const studentAnalytics = Object.entries(studentResults).map(([studentName, attempts]) => {
        const bestAttempt = attempts.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        const totalStudentAttempts = attempts.length;
        const avgScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalStudentAttempts;
        const avgAccuracy = Math.round((avgScore / totalQuestions) * 100);

        let correctAnswers = 0;
        let partialAnswers = 0;
        let incorrectAnswers = 0;

        if (bestAttempt.answers) {
            bestAttempt.answers.forEach(answer => {
                if (answer.result === 'correct') correctAnswers++;
                else if (answer.result === 'partial') partialAnswers++;
                else incorrectAnswers++;
            });
        }

        return {
            id: studentName,
            name: studentName,
            character: bestAttempt.character,
            totalPoints: bestAttempt.score,
            correctAnswers,
            partialAnswers,
            incorrectAnswers,
            totalAnswered: totalQuestions,
            accuracy: avgAccuracy,
            needsAttention: avgAccuracy < 60,
            attempts: totalStudentAttempts,
            avgScore: Math.round(avgScore * 100) / 100
        };
    });

    const classAnalytics = {
        totalStudents,
        totalQuestions,
        averageScore: Math.round(averageScore * 100) / 100,
        averageAccuracy: studentAnalytics.length > 0 ?
            Math.round((studentAnalytics.reduce((sum, student) => sum + student.accuracy, 0) / studentAnalytics.length) * 100) / 100 : 0,
        questionsNeedingReview: questionAnalytics.filter(q => q.needsReview).length,
        studentsNeedingAttention: studentAnalytics.filter(s => s.needsAttention).length,
        participationRate: 100,
        totalAttempts
    };

    return { classAnalytics, questionAnalytics, studentAnalytics };
};

app.post('/:code/results', requireAuth, async (req, res) => {
    try {
        const code = normalizePracticeCode(req.params.code);

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({message: "Invalid practice code format"});
        }

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: "Practice quiz not found"});
        }

        const meta = await readPracticeMeta(code) || {};

        if (!canManage(meta.owner, req.user)) {
            return res.status(403).json({message: "Keine Berechtigung für diese Ergebnisse."});
        }

        const results = await readPracticeResults(code);

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

        const quiz = await loadPracticeQuiz(code);

        const analytics = generatePracticeAnalytics(quiz, results, studentResults, averageScore, totalAttempts);

        res.json({
            meta: {
                created: meta.created,
                expiry: meta.expiry || null,
                totalAttempts,
                averageScore: Math.round(averageScore * 100) / 100,
                maxScore,
                minScore
            },
            results: results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            studentResults,
            quiz: quiz,
            analytics: analytics
        });
    } catch (error) {
        console.error('Error viewing practice quiz results:', error);
        res.status(500).json({message: "Error viewing practice quiz results"});
    }
});

module.exports = app;
