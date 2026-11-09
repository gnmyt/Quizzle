const {generateRoomCode, isAlphabeticCode} = require("./utils/random");
const {validateSchemaSocket} = require("./utils/error");
const {checkRoom, joinRoom, answerQuestion} = require("./validations/socket");
const {questionValidation} = require("./validations/quiz");
const {
    createSession,
    getSession,
    updateSessionSocket,
    invalidateSession,
    markSessionDisconnected,
    cleanupRoomSessions,
    getSessionBySocketId,
    getAllSessionsForRoom
} = require("./utils/session");
const {shuffleSequenceAnswers, stripAnswerContent} = require("./utils/quiz");
const {calculatePoints, calculateLiveScore} = require("./utils/scoring");
const {generateAnalytics} = require("./utils/analytics");
const {normalizeWordCloudAnswer} = require("./utils/wordCloud");
const {
    getActivePlayers,
    buildQuestionPayload,
    generateAnswerData,
    broadcastAnswerResults
} = require("./utils/room");

const rooms = {};

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

const endGameForAllPlayers = (io, room, roomCode) => {
    for (const player of Object.keys(room.players)) {
        io.to(player).emit("GAME_ENDED", room.playerAnswers.filter(answer => answer[player]));
        const playerSocket = io.sockets.sockets.get(player);
        if (playerSocket) {
            playerSocket.emit('SESSION_EXPIRED', 'Game ended');
            playerSocket.disconnect(true);
        }
    }
    cleanupRoomSessions(roomCode);
    delete rooms[roomCode];
};

const emitActivePlayerCount = (io, room) => {
    const activePlayers = getActivePlayers(room, io);
    io.to(room.host).emit('ACTIVE_PLAYER_COUNT', {
        active: Object.keys(activePlayers).length,
        total: Object.keys(room.players).length,
        expectedAnswers: Object.keys(activePlayers).length
    });
    return activePlayers;
};

const handleAllAnswered = (io, roomCode, room) => {
    const currentAnswers = room.playerAnswers[room.playerAnswers.length - 1];
    const activePlayers = getActivePlayers(room, io);

    if (Object.keys(currentAnswers).length !== Object.keys(activePlayers).length) return false;

    const answerData = generateAnswerData(room.currentQuestion, currentAnswers, room);
    room.currentQuestion.isCompleted = true;
    broadcastAnswerResults(io, roomCode, answerData, room);

    io.to(room.host).emit('ANSWERS_RECEIVED', {
        answers: currentAnswers,
        scoreboard: room.players,
        answerData,
        activePlayerCount: Object.keys(activePlayers).length,
        totalPlayerCount: Object.keys(room.players).length,
        allActiveAnswered: true
    });

    return true;
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
            currentQuestion: {}, startTime: 0, questionHistory: [], locked: false,
            settings: data?.settings || {}
        };
        currentRoomCode = roomCode;

        callback(roomCode);
    });

    socket.on('KICK_PLAYER', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!isHostAuthorized(socket, currentRoomCode) || !validateRoomState(currentRoomCode, 'waiting')) {
            return callback(false);
        }

        const room = rooms[currentRoomCode];
        let playerName, playerId;

        if (data?.id && room.players[data.id]) {
            playerId = data.id;
            playerName = room.players[data.id].name;
        } else if (data?.name) {
            for (const [id, player] of Object.entries(room.players)) {
                if (player.name === data.name) {
                    playerId = id;
                    playerName = player.name;
                    break;
                }
            }
        }

        if (!playerId || !playerName) return callback(false);

        const roomSessions = getAllSessionsForRoom(currentRoomCode);
        roomSessions.forEach(session => {
            if (session.playerData.name === playerName) {
                invalidateSession(session.token);
            }
        });

        const playerSession = getSessionBySocketId(playerId);
        if (playerSession) invalidateSession(playerSession.token);
        
        io.to(room.host).emit('PLAYER_LEFT', { id: playerId, name: playerName });
        
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket?.connected) {
            playerSocket.emit('KICKED_FROM_ROOM', 'You have been kicked from the room');
            playerSocket.disconnect(true);
        }

        delete room.players[playerId];
        
        if (room.playerAnswers?.length > 0) {
            room.playerAnswers.forEach(questionAnswers => {
                delete questionAnswers[playerId];
            });
        }

        callback(true);
    });

    socket.on('LOCK_ROOM', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!isHostAuthorized(socket, currentRoomCode) || !validateRoomState(currentRoomCode, 'waiting')) {
            return callback({success: false, error: 'Nicht autorisiert'});
        }

        const room = rooms[currentRoomCode];
        room.locked = !room.locked;
        
        callback({success: true, locked: room.locked});
    });

    socket.on('KICK_OFFLINE_PLAYER', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!data?.name || !isHostAuthorized(socket, currentRoomCode)) {
            return callback({success: false, error: 'Nicht autorisiert'});
        }

        const room = rooms[currentRoomCode];
        if (!room) return callback({success: false, error: 'Raum nicht gefunden'});

        const roomSessions = getAllSessionsForRoom(currentRoomCode);
        let removedSessions = 0;
        let playerId = null;

        roomSessions.forEach(session => {
            if (session.playerData.name === data.name) {
                invalidateSession(session.token);
                removedSessions++;
            }
        });

        for (const [id, player] of Object.entries(room.players)) {
            if (player.name === data.name) {
                playerId = id;
                delete room.players[id];
                if (room.playerAnswers?.length > 0) {
                    room.playerAnswers.forEach(questionAnswers => {
                        delete questionAnswers[id];
                    });
                }
                break;
            }
        }

        if (removedSessions > 0 || playerId) {
            io.to(room.host).emit('PLAYER_PERMANENTLY_REMOVED', {
                name: data.name,
                playerId: playerId
            });
            callback({success: true, message: `Spieler ${data.name} wurde entfernt`});
        } else {
            callback({success: false, error: 'Spieler nicht gefunden'});
        }
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
            if (room.locked) {
                return callback({success: false, error: 'Dieser Raum ist gesperrt'});
            }
            
            const {value} = joinRoom.validate(data);
            const sanitizedName = value.name;

            const roomSessions = getAllSessionsForRoom(data.code);
            roomSessions.forEach(session => {
                if (session.playerData.name.toLowerCase() === sanitizedName.toLowerCase() && 
                    (session.status === 'disconnected' || !session.isActive)) {
                    invalidateSession(session.token);
                    for (const [playerId, player] of Object.entries(room.players)) {
                        if (player.name.toLowerCase() === sanitizedName.toLowerCase()) {
                            delete room.players[playerId];
                            break;
                        }
                    }
                }
            });
            const existingNames = Object.values(room.players).map(p => p.name.toLowerCase());
            if (existingNames.includes(sanitizedName.toLowerCase())) {
                return callback({success: false, error: 'Dieser Name ist bereits vergeben'});
            }

            socket.join(data.code.toString());
            room.players[socket.id] = {name: sanitizedName, character: data.character, points: 0, streak: 0, lastRoundPoints: 0};
            
            const sessionId = createSession(socket.id, data.code, {
                name: sanitizedName,
                character: data.character
            });
            
            io.to(room.host).emit('PLAYER_JOINED', {id: socket.id, name: sanitizedName, character: data.character});
            currentRoomCode = data.code;
            callback({success: true, sessionId});
        } else {
            callback({success: false, error: 'Raum existiert nicht oder Spiel hat bereits begonnen'});
        }
    });

    socket.on('RECONNECT_WITH_SESSION', (data, callback) => {
        if (!validateCallback(callback)) return;
        
        const { sessionId } = data;
        
        if (!sessionId) {
            return callback({success: false, error: 'Keine Session ID', sessionInvalid: true});
        }
        
        const session = getSession(sessionId);
        if (!session) {
            return callback({success: false, error: 'Session nicht gefunden', sessionInvalid: true});
        }
        
        const room = rooms[session.roomCode];
        if (!room) {
            invalidateSession(sessionId);
            return callback({success: false, error: 'Raum nicht mehr verfügbar', sessionInvalid: true});
        }

        if (updateSessionSocket(sessionId, socket.id)) {
            socket.join(session.roomCode.toString());
            currentRoomCode = session.roomCode;
            
            let existingPlayerId = null;
            let existingPlayerData = null;
            
            for (const [playerId, player] of Object.entries(room.players)) {
                if (player.name === session.playerData.name) {
                    existingPlayerId = playerId;
                    existingPlayerData = player;
                    break;
                }
            }

            if (existingPlayerId && existingPlayerData) {
                delete room.players[existingPlayerId];
                room.players[socket.id] = {
                    name: existingPlayerData.name,
                    character: existingPlayerData.character,
                    points: existingPlayerData.points,
                    streak: existingPlayerData.streak || 0,
                    lastRoundPoints: existingPlayerData.lastRoundPoints || 0
                };

                if (room.playerAnswers?.length > 0) {
                    room.playerAnswers.forEach(questionAnswers => {
                        if (questionAnswers[existingPlayerId] !== undefined) {
                            questionAnswers[socket.id] = questionAnswers[existingPlayerId];
                            delete questionAnswers[existingPlayerId];
                        }
                    });
                }

                io.to(room.host).emit('PLAYER_RECONNECTED', {
                    id: socket.id,
                    name: session.playerData.name,
                    character: session.playerData.character,
                    oldId: existingPlayerId
                });
                
                if (room.state === 'ingame' && room.currentQuestion && !room.currentQuestion.isCompleted) {
                    emitActivePlayerCount(io, room);
                }
            } else {
                room.players[socket.id] = {
                    name: session.playerData.name,
                    character: session.playerData.character,
                    points: session.playerData.points || 0,
                    streak: 0,
                    lastRoundPoints: 0
                };
                
                io.to(room.host).emit('PLAYER_JOINED', {
                    id: socket.id,
                    name: session.playerData.name,
                    character: session.playerData.character
                });
            }

            const gameState = {
                roomState: room.state,
                currentQuestion: room.currentQuestion,
                playerPoints: room.players[socket.id].points,
                roomCode: session.roomCode,
                playerData: session.playerData
            };
            
            if (room.state === 'ingame' && room.currentQuestion && !room.currentQuestion.isCompleted) {
                const questionData = buildQuestionPayload(room.currentQuestion, room);
                socket.emit('QUESTION_RECEIVED', questionData);
                if (room.currentQuestion.answersReady) socket.emit('ANSWERS_READY', true);
            }

            socket.emit('GAME_STATE_RESTORED', gameState);
            
            callback({success: true, gameState});
        } else {
            callback({success: false, error: 'Fehler beim Wiederherstellen der Session'});
        }
    });

    socket.on('GET_SESSION_STATE', (data, callback) => {
        if (!validateCallback(callback)) return;
        
        const { sessionId } = data;
        
        if (!sessionId) {
            return callback({success: false, sessionInvalid: true});
        }
        
        const session = getSession(sessionId);
        if (!session) {
            return callback({success: false, sessionInvalid: true});
        }
        
        const room = rooms[session.roomCode];
        if (!room) {
            invalidateSession(sessionId);
            return callback({success: false, sessionInvalid: true});
        }

        const sessionState = {
            roomCode: session.roomCode,
            playerData: session.playerData,
            roomState: room.state,
            status: session.status
        };
        
        callback({success: true, sessionState});
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
            pointMultiplier: data.pointMultiplier,
            answers: data.type === 'text' ? data.answers : 
                     data.type === 'sequence' ? data.answers.length :
                     data.type === 'slider' ? data.answers :
                     stripAnswerContent(data.answers),
            isCompleted: false,
            answersReady: false
        };

        room.questionHistory.push({
            title: data.title,
            type: data.type,
            pointMultiplier: data.pointMultiplier,
            answers: data.answers,
            shuffledAnswers: data.type === 'sequence'
                ? shuffleSequenceAnswers(data.answers)
                : undefined
        });

        room.playerAnswers.push({});

        const questionData = buildQuestionPayload({...data, answers: data.answers}, room);
        io.to(currentRoomCode.toString()).emit('QUESTION_RECEIVED', questionData);

        emitActivePlayerCount(io, room);

        setTimeout(() => {
            if (rooms[currentRoomCode]?.currentQuestion) {
                rooms[currentRoomCode].currentQuestion.answersReady = true;
                io.to(currentRoomCode.toString()).emit('ANSWERS_READY', true);
            }
        }, 5000);
        
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

        if (!room.currentQuestion.answersReady) {
            return callback({success: false, error: 'Antworten sind noch nicht bereit'});
        }

        const playerAnswers = room.playerAnswers;
        if (playerAnswers[playerAnswers.length - 1][socket.id]) {
            return callback({success: false, error: 'Antwort bereits abgegeben'});
        }

        if (handleValidationError(callback, answerQuestion, data)) return;

        const isWordCloud = room.currentQuestion.type === 'word-cloud';
        const submittedAnswer = isWordCloud ? normalizeWordCloudAnswer(data.answers) : data.answers;
        if (isWordCloud && submittedAnswer === null) {
            return callback({success: false, error: 'Bitte gib einen Begriff mit maximal 40 Zeichen ein.'});
        }
        playerAnswers[playerAnswers.length - 1][socket.id] = submittedAnswer;

        const score = calculateLiveScore(room.currentQuestion, data.answers);
        const isFlatScoring = room.settings?.scoringMode === 'flat';
        const points = isFlatScoring
            ? (score > 0 ? (room.currentQuestion.pointMultiplier === 'none' ? 0 : room.currentQuestion.pointMultiplier === 'double' ? 200 : 100) : 0)
            : calculatePoints(score, room.startTime, room.currentQuestion.pointMultiplier);
        room.players[socket.id].points += points;
        room.players[socket.id].lastRoundPoints = points;
        if (!isWordCloud) {
            room.players[socket.id].streak = score >= 1
                ? (room.players[socket.id].streak || 0) + 1
                : 0;
        } else {
            io.to(room.host).emit('WORD_CLOUD_UPDATED', generateAnswerData(
                room.currentQuestion, playerAnswers[playerAnswers.length - 1], room
            ));
        }

        if (!handleAllAnswered(io, currentRoomCode, room)) {
            const activePlayers = getActivePlayers(room, io);
            const currentAnswers = playerAnswers[playerAnswers.length - 1];

            io.to(room.host).emit('ANSWER_PROGRESS', {
                answeredCount: Object.keys(currentAnswers).length,
                activePlayerCount: Object.keys(activePlayers).length,
                totalPlayerCount: Object.keys(room.players).length
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
        const answerData = generateAnswerData(room.currentQuestion, currentAnswers, room);
        const activePlayers = getActivePlayers(room, io);

        broadcastAnswerResults(io, currentRoomCode, answerData, room);

        callback({
            answers: currentAnswers,
            scoreboard: room.players,
            answerData: answerData,
            activePlayerCount: Object.keys(activePlayers).length,
            totalPlayerCount: Object.keys(room.players).length,
            skipped: true
        });
    });

    socket.on('END_GAME', (data, callback) => {
        if (!validateCallback(callback)) return;
        if (!isHostAuthorized(socket, currentRoomCode) || !validateRoomState(currentRoomCode, 'ingame')) {
            return callback(false);
        }

        const room = rooms[currentRoomCode];
        const players = Object.entries(room.players).map(([id, p]) => ({
            id, name: p.name, character: p.character, points: p.points
        }));
        const analytics = generateAnalytics({
            players,
            playerAnswers: room.playerAnswers,
            questionHistory: room.questionHistory
        });
        
        callback({
            playerAnswers: room.playerAnswers, 
            players: room.players,
            analytics
        });
        endGameForAllPlayers(io, room, currentRoomCode);
    });

    socket.on('disconnect', () => {
        if (!currentRoomCode || !rooms[currentRoomCode]) {
            const session = getSessionBySocketId(socket.id);
            if (session) {
                markSessionDisconnected(session.token);
            }
            return;
        }

        const room = rooms[currentRoomCode];

        if (room.host === socket.id) {
            io.to(currentRoomCode.toString()).emit('HOST_DISCONNECTED', 'Host has left the game');
            endGameForAllPlayers(io, room, currentRoomCode);
            return;
        }

        if (room.players[socket.id]) {
            const session = getSessionBySocketId(socket.id);
            if (session) {
                markSessionDisconnected(session.token);
                session.playerData.points = room.players[socket.id].points;
                session.playerData.name = room.players[socket.id].name;
                session.playerData.character = room.players[socket.id].character;
            }

            const playerName = room.players[socket.id].name;
            io.to(room.host).emit('PLAYER_DISCONNECTED', {
                id: socket.id,
                name: playerName,
                temporary: true
            });
            
            if (room.state === 'ingame' && room.currentQuestion && !room.currentQuestion.isCompleted) {
                emitActivePlayerCount(io, room);
                handleAllAnswered(io, currentRoomCode, room);
            }
        }
    });
};
