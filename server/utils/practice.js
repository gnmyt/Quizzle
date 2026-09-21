const path = require("path");
const fs = require("fs").promises;
const {practiceQuizzesFolder} = require("./file");
const {isAlphabeticCode} = require("./random");
const {decompressQuiz} = require("./quiz");

const metaFileName = 'meta.json';
const quizFileName = 'quiz.quizzle';
const resultsFolderName = 'results';

const practiceCodePattern = /^[A-Z]{4}$/;

const normalizePracticeCode = (code) => String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase();

const isSafePracticeCode = (code) => typeof code === 'string' && practiceCodePattern.test(code);

const resolvePracticeDir = (code) => {
    const normalized = normalizePracticeCode(code);
    if (!isSafePracticeCode(normalized)) return null;
    return path.join(practiceQuizzesFolder, normalized);
};

const practiceQuizExists = async (code) => {
    const dir = resolvePracticeDir(code);
    if (!dir) return false;

    try {
        const stats = await fs.stat(dir);
        return stats.isDirectory();
    } catch {
        return false;
    }
};

const readJsonFile = async (filePath) => {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
        return null;
    }
};

const readPracticeMeta = async (code) => {
    const dir = resolvePracticeDir(code);
    if (!dir) return null;

    const meta = await readJsonFile(path.join(dir, metaFileName));
    return meta && typeof meta === 'object' ? meta : null;
};

const writePracticeMeta = async (code, meta) => {
    const dir = resolvePracticeDir(code);
    if (!dir) return false;

    await fs.writeFile(path.join(dir, metaFileName), JSON.stringify(meta, null, 2));
    return true;
};

const loadPracticeQuiz = async (code) => {
    const dir = resolvePracticeDir(code);
    if (!dir) throw new Error('Invalid practice code');

    return decompressQuiz(await fs.readFile(path.join(dir, quizFileName)));
};

const readPracticeResults = async (code) => {
    const dir = resolvePracticeDir(code);
    if (!dir) return [];

    const resultsDir = path.join(dir, resultsFolderName);

    let files;
    try {
        files = await fs.readdir(resultsDir);
    } catch {
        return [];
    }

    const results = [];
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const result = await readJsonFile(path.join(resultsDir, file));
        if (result) results.push(result);
    }

    return results;
};

const getQuizFileStats = async (dir) => {
    try {
        const stats = await fs.stat(path.join(dir, quizFileName));
        return {created: stats.birthtime.toISOString(), modified: stats.mtime.toISOString()};
    } catch {
        return {created: null, modified: null};
    }
};

const getResultCount = async (dir) => {
    try {
        return (await fs.readdir(path.join(dir, resultsFolderName))).filter(file => file.endsWith('.json')).length;
    } catch {
        return 0;
    }
};

const listPracticeQuizzes = async () => {
    let codes;
    try {
        codes = await fs.readdir(practiceQuizzesFolder);
    } catch {
        return [];
    }

    const entries = [];

    for (const code of codes) {
        if (!isSafePracticeCode(code)) continue;

        const dir = path.join(practiceQuizzesFolder, code);

        try {
            if (!(await fs.stat(dir)).isDirectory()) continue;
        } catch {
            continue;
        }

        const meta = await readPracticeMeta(code) || {};
        const {created, modified} = await getQuizFileStats(dir);
        const effectiveExpiry = getEffectiveExpiry(meta);

        let title = code;
        let questionCount = 0;
        try {
            const quiz = await loadPracticeQuiz(code);
            title = quiz.title || code;
            questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
        } catch {
        }

        entries.push({
            code,
            title,
            questionCount,
            created: meta.created || created,
            modified,
            expiry: meta.expiry || null,
            effectiveExpiry: effectiveExpiry ? effectiveExpiry.toISOString() : null,
            expired: isPracticeExpired(meta),
            resultCount: await getResultCount(dir),
            owner: meta.owner || null,
            ownerName: meta.ownerName || null,
        });
    }

    return entries.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
};

/**
 * Practice codes created before custom expiries existed default to a 14 day validity,
 * matching the previous hard-coded behaviour, so old tests keep their original status.
 */
const legacyPracticeValidityMs = 14 * 24 * 60 * 60 * 1000;

const getEffectiveExpiry = (meta) => {
    if (!meta) return null;

    if (meta.expiry !== undefined && meta.expiry !== null) {
        const expiry = new Date(meta.expiry);
        return Number.isNaN(expiry.getTime()) ? null : expiry;
    }

    // An explicit null means "never expires"; only a missing field is a legacy test.
    if (meta.expiry === null) return null;

    if (meta.created) {
        const created = new Date(meta.created);
        if (!Number.isNaN(created.getTime())) return new Date(created.getTime() + legacyPracticeValidityMs);
    }

    return null;
};

const isPracticeExpired = (meta) => {
    const expiry = getEffectiveExpiry(meta);
    if (!expiry) return false;
    return expiry.getTime() <= Date.now();
};

const deletePracticeQuiz = async (code) => {
    const dir = resolvePracticeDir(code);
    if (!dir || !await practiceQuizExists(code)) return false;

    await fs.rm(dir, {recursive: true, force: true});
    return true;
};

module.exports = {
    practiceCodePattern,
    normalizePracticeCode,
    isSafePracticeCode,
    resolvePracticeDir,
    practiceQuizExists,
    readPracticeMeta,
    writePracticeMeta,
    loadPracticeQuiz,
    readPracticeResults,
    listPracticeQuizzes,
    getEffectiveExpiry,
    isPracticeExpired,
    deletePracticeQuiz,
};