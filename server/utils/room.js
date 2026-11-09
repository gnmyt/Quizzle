const { resolveQuestionType } = require('./quiz');
const {WORD_CLOUD_MAX_LENGTH, buildWordCloud} = require('./wordCloud');

const getActivePlayers = (room, io) => {
    const activePlayers = {};
    for (const [playerId, player] of Object.entries(room.players)) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket?.connected) activePlayers[playerId] = player;
    }
    return activePlayers;
};

const buildQuestionPayload = (question, room) => {
    const questionData = {
        type: resolveQuestionType(question.type, question.answers || []),
        title: question.title
    };

    if (question.type === 'word-cloud') {
        questionData.maxLength = WORD_CLOUD_MAX_LENGTH;
    } else if (question.type === 'text') {
        questionData.maxLength = 200;
    } else if (question.type === 'sequence') {
        const historyEntry = room.questionHistory[room.questionHistory.length - 1];
        questionData.answers = historyEntry?.shuffledAnswers || question.answers;
    } else if (question.type === 'slider') {
        const config = Array.isArray(question.answers) ? question.answers[0] : question.answers;
        questionData.sliderConfig = {
            min: config.min,
            max: config.max,
            step: config.step || 1
        };
    } else {
        questionData.answers = Array.isArray(question.answers)
            ? question.answers.length
            : question.answers;
    }

    return questionData;
};

const generateAnswerData = (currentQuestion, currentAnswers, room) => {
    if (currentQuestion.type === 'word-cloud') {
        return {type: 'word-cloud', ...buildWordCloud(Object.values(currentAnswers))};
    }

    if (currentQuestion.type === 'text') {
        return { answers: currentQuestion.answers.map(a => a.content) };
    }

    if (currentQuestion.type === 'slider') {
        const config = Array.isArray(currentQuestion.answers) ? currentQuestion.answers[0] : currentQuestion.answers;
        const playerValues = Object.values(currentAnswers).filter(v => typeof v === 'number');
        return {
            correctValue: config.correctValue,
            min: config.min,
            max: config.max,
            answerMargin: config.answerMargin || 'medium',
            playerValues
        };
    }

    if (currentQuestion.type === 'sequence') {
        const historyEntry = room.questionHistory[room.questionHistory.length - 1];
        const answers = historyEntry ? historyEntry.answers : currentQuestion.answers;
        return {
            answers,
            correctOrder: (Array.isArray(answers) ? answers : []).map((_, i) => i)
        };
    }

    const voteCounts = new Array(
        Array.isArray(currentQuestion.answers)
            ? currentQuestion.answers.length
            : currentQuestion.answers
    ).fill(0);

    Object.values(currentAnswers).forEach(playerAnswers => {
        if (Array.isArray(playerAnswers)) {
            playerAnswers.forEach(idx => {
                if (idx >= 0 && idx < voteCounts.length) voteCounts[idx]++;
            });
        }
    });

    const historyEntry = room.questionHistory[room.questionHistory.length - 1];
    const fullAnswers = Array.isArray(historyEntry?.answers) ? historyEntry.answers : null;

    return {
        answers: Array.isArray(currentQuestion.answers)
            ? currentQuestion.answers.map(a => a.is_correct)
            : [],
        answerLabels: fullAnswers
            ? fullAnswers.map(a => (a && a.type !== 'image' ? a.content : null))
            : [],
        voteCounts
    };
};

const broadcastAnswerResults = (io, roomCode, answerData, room) => {
    io.to(roomCode.toString()).emit('ANSWER_RECEIVED', answerData);

    const sorted = Object.entries(room.players)
        .map(([id, p]) => ({ id, name: p.name, points: p.points }))
        .sort((a, b) => b.points - a.points);

    for (const player of Object.keys(room.players)) {
        const p = room.players[player];
        const rank = sorted.findIndex(s => s.id === player) + 1;
        const aheadPlayer = rank > 1 ? sorted[rank - 2] : null;

        io.to(player).emit("POINTS_RECEIVED", {
            points: p.points,
            pointsEarned: room.currentQuestion.type === 'word-cloud' ? 0 : p.lastRoundPoints || 0,
            rank,
            totalPlayers: sorted.length,
            streak: p.streak || 0,
            ahead: aheadPlayer ? { name: aheadPlayer.name, gap: aheadPlayer.points - p.points } : null
        });
    }
};

module.exports = {
    getActivePlayers,
    buildQuestionPayload,
    generateAnswerData,
    broadcastAnswerResults
};
