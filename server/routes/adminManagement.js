const app = require('express').Router();
const {requireAuth} = require('../middleware/auth');
const {validateSchema} = require('../utils/error');
const {practiceExpiryValidation} = require('../validations/quiz');
const {listSavedQuizzes, readSavedQuiz, readSavedQuizMeta, deleteSavedQuiz, isSafeQuizId} = require('../utils/savedQuizzes');
const {isAdminUser, isOwner, isVisibleTo} = require('../utils/ownership');
const {
    listPracticeQuizzes,
    readPracticeMeta,
    writePracticeMeta,
    deletePracticeQuiz,
    practiceQuizExists,
    isSafePracticeCode,
    getEffectiveExpiry,
    isPracticeExpired,
} = require('../utils/practice');

/**
 * Teachers only ever see their own quizzes and tests. Legacy entries without an owner
 * stay available to admins but are deliberately not attributed to any teacher.
 */
const scopeEntries = (entries, user) => {
    if (isAdminUser(user)) return entries;
    return entries.filter(entry => isOwner(entry.owner, user));
};

/**
 * Non-owned resources are reported as missing so that their existence is not disclosed.
 */
const requireVisible = (ownerId, user, res) => {
    if (isVisibleTo(ownerId, user)) return true;
    res.status(404).json({message: 'Nicht gefunden.'});
    return false;
};

app.get('/quizzes', requireAuth, async (req, res) => {
    try {
        const quizzes = scopeEntries(await listSavedQuizzes(), req.user);
        res.json({quizzes});
    } catch (error) {
        console.error('Error listing quizzes:', error);
        res.status(500).json({message: 'Quizze konnten nicht geladen werden.'});
    }
});

app.get('/quizzes/:quizId', requireAuth, async (req, res) => {
    try {
        const {quizId} = req.params;

        if (!isSafeQuizId(quizId)) {
            return res.status(400).json({message: 'Ungültige Quiz-ID.'});
        }

        const meta = await readSavedQuizMeta(quizId) || {};
        if (!requireVisible(meta.owner, req.user, res)) return;

        const quiz = await readSavedQuiz(quizId);
        if (!quiz) {
            return res.status(404).json({message: 'Quiz nicht gefunden.'});
        }

        res.json({
            quizId: quizId.toUpperCase(),
            title: quiz.title || quizId,
            questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
            questions: quiz.questions || [],
            settings: quiz.settings || {}
        });
    } catch (error) {
        console.error('Error loading quiz metadata:', error);
        res.status(500).json({message: 'Quiz konnte nicht geladen werden.'});
    }
});

app.delete('/quizzes/:quizId', requireAuth, async (req, res) => {
    try {
        const {quizId} = req.params;

        if (!isSafeQuizId(quizId)) {
            return res.status(400).json({message: 'Ungültige Quiz-ID.'});
        }

        const meta = await readSavedQuizMeta(quizId) || {};
        if (!requireVisible(meta.owner, req.user, res)) return;

        if (!await deleteSavedQuiz(quizId)) {
            return res.status(404).json({message: 'Quiz nicht gefunden.'});
        }

        res.json({success: true});
    } catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({message: 'Quiz konnte nicht gelöscht werden.'});
    }
});

app.get('/practice', requireAuth, async (req, res) => {
    try {
        const practiceQuizzes = scopeEntries(await listPracticeQuizzes(), req.user);
        res.json({practiceQuizzes});
    } catch (error) {
        console.error('Error listing practice quizzes:', error);
        res.status(500).json({message: 'Tests konnten nicht geladen werden.'});
    }
});

app.get('/practice/:code', requireAuth, async (req, res) => {
    try {
        const {code} = req.params;

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({message: 'Ungültiger Practice-Code.'});
        }

        const meta = await readPracticeMeta(code) || {};
        if (!requireVisible(meta.owner, req.user, res)) return;

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: 'Test nicht gefunden.'});
        }

        const expiry = getEffectiveExpiry(meta);

        res.json({
            code,
            created: meta.created || null,
            expiry: meta.expiry || null,
            effectiveExpiry: expiry ? expiry.toISOString() : null,
            expired: isPracticeExpired(meta),
        });
    } catch (error) {
        console.error('Error loading practice quiz metadata:', error);
        res.status(500).json({message: 'Test konnte nicht geladen werden.'});
    }
});

app.put('/practice/:code/expiry', requireAuth, async (req, res) => {
    try {
        const {code} = req.params;
        const {expiry} = req.body;

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({message: 'Ungültiger Practice-Code.'});
        }

        const existingMeta = await readPracticeMeta(code) || {};
        if (!requireVisible(existingMeta.owner, req.user, res)) return;

        if (validateSchema(res, practiceExpiryValidation, expiry)) return;

        if (!await practiceQuizExists(code)) {
            return res.status(404).json({message: 'Test nicht gefunden.'});
        }

        const meta = {...existingMeta, created: existingMeta.created || new Date().toISOString()};
        meta.expiry = expiry ? new Date(expiry).toISOString() : null;

        await writePracticeMeta(code, meta);

        res.json({
            success: true,
            expiry: meta.expiry,
            expired: isPracticeExpired(meta),
        });
    } catch (error) {
        console.error('Error updating practice quiz expiry:', error);
        res.status(500).json({message: 'Ablaufdatum konnte nicht gespeichert werden.'});
    }
});

app.delete('/practice/:code', requireAuth, async (req, res) => {
    try {
        const {code} = req.params;

        if (!isSafePracticeCode(code)) {
            return res.status(400).json({message: 'Ungültiger Practice-Code.'});
        }

        const meta = await readPracticeMeta(code) || {};
        if (!requireVisible(meta.owner, req.user, res)) return;

        if (!await deletePracticeQuiz(code)) {
            return res.status(404).json({message: 'Test nicht gefunden.'});
        }

        res.json({success: true});
    } catch (error) {
        console.error('Error deleting practice quiz:', error);
        res.status(500).json({message: 'Test konnte nicht gelöscht werden.'});
    }
});

module.exports = app;
