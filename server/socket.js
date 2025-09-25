const {generateRoomCode, isAlphabeticCode} = require("./utils/random");
const {validateSchemaSocket} = require("./utils/error");
const {checkRoom, joinRoom, answerQuestion} = require("./validations/socket");
const {questionValidation} = require("./validations/quiz");

const rooms = {};

const calculatePoints = (correctAnswers, room) => {
    const basePoints = 100;
    const maxTime = 30000;
    const timeTaken = Math.min(maxTime, Date.now() - room.startTime);
    const timeFactor = 1 - timeTaken / maxTime;

    return correctAnswers > 0 ? Math.round(basePoints * timeFactor + (correctAnswers * basePoints)) : 0;
}

const validateCallback = (callback) => {
    if (!callback) return false;
    return true;
};

const isHostAuthorized = (socket, roomCode) => {
    return rooms[roomCode]?.host === socket.id;
};

const validateRoomState = (roomCode, expectedState) => {
    return rooms[roomCode]?.state === expectedState;
};

const handleValidationError = (callback, schema, data) => {
    const validationResult = validateSchemaSocket(null, schema, data);
    if (validationResult) {
        callback({success: false, error: validationResult.details[0].message});
        return true;
    }
    return false;
};

const generateAnswerData = (currentQuestion, currentAnswers) => {
    if (currentQuestion.type === 'text') {
        return {
            answers: currentQuestion.answers.map(a => a.content)
        };
    } else {
        const voteCounts = new Array(currentQuestion.answers.length).fill(0);

        Object.values(currentAnswers).forEach(playerAnswers => {
            if (Array.isArray(playerAnswers)) {
                playerAnswers.forEach(answerIndex => {
                    if (answerIndex >= 0 && answerIndex < voteCounts.length) {
                        voteCounts[answerIndex]++;
                    }
                });
            }
        });

        return {
            answers: currentQuestion.answers.map(answer => answer.is_correct),
            voteCounts: voteCounts
        };
    }
};

const broadcastAnswerResults = (io, roomCode, answerData, room) => {
    io.to(roomCode.toString()).emit('ANSWER_RECEIVED', answerData);

    for (const player of Object.keys(room.players)) {
        io.to(player).emit("POINTS_RECEIVED", room.players[player].points);
    }
};

const endGameForAllPlayers = (io, room, roomCode) => {
    for (const player of Object.keys(room.players)) {
        io.to(player).emit("GAME_ENDED", room.playerAnswers.filter(answer => answer[player]));
        io.sockets.sockets.get(player)?.disconnect();
    }
    delete rooms[roomCode];
};

module.exports = (io, socket) => {
    let currentRoomCode;

    socket.on('CREATE_ROOM', (data, callback) => {
        if (!validateCallback(callback)) return;

        for (const roomCode in rooms) {
            if (rooms[roomCode].host === socket.id) return callback(roomCode);
        }

        const roomCode = generateRoomCode();
        while (rooms[roomCode]) generateRoomCode();

        socket.join(roomCode.toString());
        rooms[roomCode] = {
            host: socket.id, code: roomCode, state: 'waiting', players: {}, playerAnswers: [],
            currentQuestion: {}, startTime: 0
        };
        currentRoomCode = roomCode;

        callback(roomCode);
    });

    socket.on('KICK_PLAYER', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!data?.id || !isHostAuthorized(socket, currentRoomCode) ||
            !rooms[currentRoomCode].players[data.id] || !validateRoomState(currentRoomCode, 'waiting')) {
            return callback(false);
        }

        const room = rooms[currentRoomCode];
        io.to(room.host).emit('PLAYER_LEFT', {
            id: data.id,
            name: room.players[data.id].name
        });
        io.sockets.sockets.get(data.id)?.disconnect();

        delete room.players[data.id];
        callback(true);
    });

    socket.on('CHECK_ROOM', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (handleValidationError(callback, checkRoom, data)) return;

        if (isAlphabeticCode(data.code)) {
            callback({success: true, exists: false, isPractice: true});
        } else {
            callback({success: true, exists: !!rooms[data.code], isPractice: false});
        }
    });

    socket.on('JOIN_ROOM', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (handleValidationError(callback, joinRoom, data)) return;

        const room = rooms[data.code];
        if (room && room.state === 'waiting' && !room.players[socket.id]) {
            const {value} = joinRoom.validate(data);
            const sanitizedName = value.name;

            const existingNames = Object.values(room.players).map(p => p.name.toLowerCase());
            if (existingNames.includes(sanitizedName.toLowerCase())) {
                callback({success: false, error: 'Dieser Name ist bereits vergeben'});
                return;
            }

            socket.join(data.code.toString());
            room.players[socket.id] = {name: sanitizedName, character: data.character, points: 0};
            io.to(room.host).emit('PLAYER_JOINED', {id: socket.id, name: sanitizedName, character: data.character});
            currentRoomCode = data.code;
            callback({success: true});
        } else {
            callback({success: false, error: 'Raum existiert nicht oder Spiel hat bereits begonnen'});
        }
    });

    socket.on('SHOW_QUESTION', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!rooms[currentRoomCode]) return callback({success: false, error: 'Raum nicht gefunden'});
        if (!isHostAuthorized(socket, currentRoomCode)) return callback({success: false, error: 'Nicht autorisiert'});
        if (handleValidationError(callback, questionValidation, data)) return;

        const room = rooms[currentRoomCode];
        room.state = 'ingame';

        room.currentQuestion = {
            title: data.title,
            type: data.type,
            answers: data.type === 'text' ? data.answers : data.answers.map(answer => {
                const {content, ...rest} = answer;
                return rest;
            }),
            isCompleted: false
        };

        room.playerAnswers.push({});

        let questionType = data.type;
        if (data.type === 'multiple-choice') {
            const isMultipleChoice = data.answers.filter(answer => answer.is_correct).length > 1;
            questionType = isMultipleChoice ? 'multiple' : 'single';
        }

        const questionData = {
            type: questionType,
            title: data.title
        };

        if (data.type === 'text') {
            questionData.maxLength = 200;
        } else {
            questionData.answers = data.answers.length;
        }

        io.to(currentRoomCode.toString()).emit('QUESTION_RECEIVED', questionData);
        room.startTime = Date.now();
        callback({success: true});
    });

    socket.on('SUBMIT_ANSWER', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!rooms[currentRoomCode]?.players[socket.id]) {
            return callback({success: false, error: 'Spieler nicht im Raum'});
        }

        const room = rooms[currentRoomCode];
        if (room.currentQuestion.isCompleted) {
            return callback({success: false, error: 'Diese Frage wurde bereits abgeschlossen'});
        }

        const playerAnswers = room.playerAnswers;
        if (playerAnswers[playerAnswers.length - 1][socket.id]) {
            return callback({success: false, error: 'Antwort bereits abgegeben'});
        }

        if (handleValidationError(callback, answerQuestion, data)) return;

        playerAnswers[playerAnswers.length - 1][socket.id] = data.answers;

        let correctAnswers = 0;
        const currentQuestion = room.currentQuestion;

        if (currentQuestion.type === 'text') {
            const userAnswer = data.answers.toLowerCase().trim();
            const correctTextAnswers = currentQuestion.answers.map(a => a.content.toLowerCase().trim());
            correctAnswers = correctTextAnswers.includes(userAnswer) ? 1 : 0;
        } else {
            let correctSelected = 0;
            let incorrectSelected = 0;

            for (const answer of data.answers) {
                if (currentQuestion.answers[answer].is_correct) {
                    correctSelected++;
                } else {
                    incorrectSelected++;
                }
            }

            if (correctSelected > 0) {
                correctAnswers = Math.max(0.1, correctSelected - (incorrectSelected * 0.5));
            } else {
                correctAnswers = 0;
            }
        }

        const points = calculatePoints(correctAnswers, room);
        room.players[socket.id].points += points;

        const currentAnswers = playerAnswers[playerAnswers.length - 1];
        if (Object.keys(currentAnswers).length === Object.keys(room.players).length) {
            const answerData = generateAnswerData(currentQuestion, currentAnswers);
            room.currentQuestion.isCompleted = true;

            broadcastAnswerResults(io, currentRoomCode, answerData, room);

            io.to(room.host).emit('ANSWERS_RECEIVED', {
                answers: currentAnswers,
                scoreboard: room.players,
                answerData: answerData
            });
        }

        callback({success: true});
    });

    socket.on('SKIP_QUESTION', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!isHostAuthorized(socket, currentRoomCode) || !validateRoomState(currentRoomCode, 'ingame')) {
            return callback(false);
        }

        const room = rooms[currentRoomCode];
        room.currentQuestion.isCompleted = true;

        const currentAnswers = room.playerAnswers[room.playerAnswers.length - 1];
        const answerData = generateAnswerData(room.currentQuestion, currentAnswers);

        broadcastAnswerResults(io, currentRoomCode, answerData, room);

        callback({
            answers: currentAnswers,
            scoreboard: room.players,
            answerData: answerData
        });
    });

    socket.on('END_GAME', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!isHostAuthorized(socket, currentRoomCode) || !validateRoomState(currentRoomCode, 'ingame')) {
            return callback(false);
        }

        const room = rooms[currentRoomCode];
        callback({playerAnswers: room.playerAnswers, players: room.players});
        endGameForAllPlayers(io, room, currentRoomCode);
    });

    socket.on('disconnect', () => {
        if (!currentRoomCode || !rooms[currentRoomCode]) return;

        const room = rooms[currentRoomCode];

        if (room.host === socket.id) {
            endGameForAllPlayers(io, room, currentRoomCode);
            return;
        }

        if (room.players[socket.id]) {
            io.to(room.host).emit('PLAYER_LEFT', {
                id: socket.id,
                name: room.players[socket.id].name
            });
            delete room.players[socket.id];
        }
    });
};