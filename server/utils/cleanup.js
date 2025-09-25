const fs = require("fs").promises;
const path = require("path");

const practiceQuizzesDir = path.join(__dirname, '../../data/practice-quizzes');

const isAlphabeticCode = (code) => {
    return /^[A-Z]{4}$/i.test(code);
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

const cleanupExpiredPracticeQuizzes = async () => {
    try {
        try {
            await fs.access(practiceQuizzesDir);
        } catch {
            return 0;
        }

        const codes = await fs.readdir(practiceQuizzesDir);
        let cleanedCount = 0;

        for (const code of codes) {
            if (isAlphabeticCode(code)) {
                if (await isPracticeQuizExpired(code)) {
                    const quizDir = path.join(practiceQuizzesDir, code);
                    await fs.rm(quizDir, { recursive: true, force: true });
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleanup completed: removed ${cleanedCount} expired practice quizzes`);
        }
        
        return cleanedCount;
    } catch (error) {
        console.error('Error during practice quiz cleanup:', error);
        return 0;
    }
};

const startCleanupTask = () => {
    setTimeout(() => {
        cleanupExpiredPracticeQuizzes();
    }, 30000);

    setInterval(() => {
        cleanupExpiredPracticeQuizzes();
    }, 6 * 60 * 60 * 1000);
};

module.exports = {
    cleanupExpiredPracticeQuizzes,
    startCleanupTask
};
