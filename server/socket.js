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

const rooms = {};

const isSequenceCompletelyCorrect = (userOrder, correctOrder) => {
    if (userOrder.length !== correctOrder.length) {
        return false;
    }
    
    for (let i = 0; i < userOrder.length; i++) {
        if (userOrder[i] !== correctOrder[i]) {
            return false;
        }
    }
    
    return true;
};

const calculateSequencePartialScore = (userOrder, correctOrder) => {
    let correctPositions = 0;
    for (let i = 0; i < Math.min(userOrder.length, correctOrder.length); i++) {
        if (userOrder[i] === correctOrder[i]) {
            correctPositions++;
        }
    }
    return correctPositions / correctOrder.length;
};

const validateSequenceAnswer = (userOrder, question) => {
    let correctOrder;
    if (Array.isArray(question.answers)) {
        correctOrder = question.answers.map((_, index) => index);
    } else if (typeof question.answers === 'number') {
        correctOrder = Array.from({length: question.answers}, (_, index) => index);
    } else {
        correctOrder = Array.from({length: userOrder.length}, (_, index) => index);
    }
    
    const isCompletelyCorrect = isSequenceCompletelyCorrect(userOrder, correctOrder);
    
    if (isCompletelyCorrect) {
        return { isCorrect: true, score: 1 };
    } else {
        const partialScore = calculateSequencePartialScore(userOrder, correctOrder);
        return { 
            isCorrect: false, 
            score: partialScore >= 0.99 ? 1 : Math.max(0.1, partialScore),
            isPartial: partialScore > 0
        };
    }
};

const calculatePoints = (correctAnswers, room, pointMultiplier) => {
    if (pointMultiplier === 'none') {
        return 0;
    }
    
    const basePoints = 100;
    const maxTime = 30000;
    const timeTaken = Math.min(maxTime, Date.now() - room.startTime);
    const timeFactor = 1 - timeTaken / maxTime;

    let points = correctAnswers > 0 ? Math.round(basePoints * timeFactor + (correctAnswers * basePoints)) : 0;

    if (pointMultiplier === 'double') {
        points *= 2;
    }
    
    return points;
}

const getActivePlayers = (room, io) => {
    const activePlayers = {};
    for (const [playerId, player] of Object.entries(room.players)) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket?.connected) activePlayers[playerId] = player;
    }
    return activePlayers;
};

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

const generateAnswerData = (currentQuestion, currentAnswers, room) => {
    if (currentQuestion.type === 'text') {
        return {
            answers: currentQuestion.answers.map(a => a.content)
        };
    } else if (currentQuestion.type === 'sequence') {
        const originalQuestion = room.questionHistory[room.questionHistory.length - 1];
        return {
            answers: originalQuestion ? originalQuestion.answers : currentQuestion.answers,
            correctOrder: (originalQuestion ? originalQuestion.answers : currentQuestion.answers).map((_, index) => index)
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

const generateAnalyticsData = (room) => {
    const players = Object.keys(room.players);
    const totalQuestions = room.playerAnswers.length;

    const questionAnalytics = room.playerAnswers.map((questionAnswers, questionIndex) => {
        const totalResponses = Object.keys(questionAnswers).length;
        const question = room.questionHistory[questionIndex];
        
        if (!question) {
            return {
                questionIndex,
                totalResponses: 0,
                correctCount: 0,
                partialCount: 0,
                incorrectCount: 0,
                correctPercentage: 0,
                difficulty: 'unknown',
                title: 'Unknown Question'
            };
        }
        
        let correctCount = 0;
        let partialCount = 0;
        let incorrectCount = 0;

        Object.values(questionAnswers).forEach(playerAnswer => {
            if (question.type === 'text') {
                const isCorrect = question.answers.some(acceptedAnswer => 
                    acceptedAnswer.content.toLowerCase().trim() === playerAnswer.toLowerCase().trim()
                );
                if (isCorrect) correctCount++;
                else incorrectCount++;
            } else if (question.type === 'sequence') {
                const sequenceResult = validateSequenceAnswer(playerAnswer, question);
                
                if (sequenceResult.isCorrect) {
                    correctCount++;
                } else if (sequenceResult.isPartial) {
                    partialCount++;
                } else {
                    incorrectCount++;
                }
            } else {
                let correctSelected = 0;
                let incorrectSelected = 0;
                
                const playerAnswers = Array.isArray(playerAnswer) ? playerAnswer : [playerAnswer];
                
                playerAnswers.forEach(answerIndex => {
                    if (question.answers[answerIndex]?.is_correct) {
                        correctSelected++;
                    } else {
                        incorrectSelected++;
                    }
                });
                
                const totalCorrectAnswers = question.answers.filter(a => a.is_correct).length;
                
                if (correctSelected === totalCorrectAnswers && incorrectSelected === 0) {
                    correctCount++;
                } else if (correctSelected > 0) {
                    partialCount++;
                } else {
                    incorrectCount++;
                }
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
            difficulty: totalResponses > 0 ? 
                (correctPercentage >= 80) ? 'easy' :
                (correctPercentage >= 60) ? 'medium' : 'hard' : 'unknown',
            needsReview: correctPercentage < 60
        };
    });

    const studentAnalytics = players.map(playerId => {
        const player = room.players[playerId];
        const studentAnswers = room.playerAnswers.map(questionAnswers => questionAnswers[playerId]);
        
        let correctAnswers = 0;
        let partialAnswers = 0;
        let incorrectAnswers = 0;
        
        studentAnswers.forEach((answer, questionIndex) => {
            const question = room.questionHistory[questionIndex];
            
            if (answer !== undefined && question) {
                if (question.type === 'text') {
                    const isCorrect = question.answers.some(acceptedAnswer => 
                        acceptedAnswer.content.toLowerCase().trim() === answer.toLowerCase().trim()
                    );
                    if (isCorrect) correctAnswers++;
                    else incorrectAnswers++;
                } else if (question.type === 'sequence') {
                    const sequenceResult = validateSequenceAnswer(answer, question);
                    
                    if (sequenceResult.isCorrect) {
                        correctAnswers++;
                    } else if (sequenceResult.isPartial) {
                        partialAnswers++;
                    } else {
                        incorrectAnswers++;
                    }
                } else {
                    let correctSelected = 0;
                    let incorrectSelected = 0;
                    
                    const playerAnswers = Array.isArray(answer) ? answer : [answer];
                    
                    playerAnswers.forEach(answerIndex => {
                        if (question.answers[answerIndex]?.is_correct) {
                            correctSelected++;
                        } else {
                            incorrectSelected++;
                        }
                    });
                    
                    const totalCorrectAnswers = question.answers.filter(a => a.is_correct).length;
                    
                    if (correctSelected === totalCorrectAnswers && incorrectSelected === 0) {
                        correctAnswers++;
                    } else if (correctSelected > 0) {
                        partialAnswers++;
                    } else {
                        incorrectAnswers++;
                    }
                }
            }
        });
        
        const totalAnswered = studentAnswers.filter(answer => answer !== undefined).length;
        
        return {
            id: playerId,
            name: player.name,
            character: player.character,
            totalPoints: player.points,
            correctAnswers,
            partialAnswers,
            incorrectAnswers,
            totalAnswered,
            accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
            needsAttention: correctAnswers < (totalAnswered * 0.6)
        };
    });

    const totalAnsweredQuestions = studentAnalytics.reduce((sum, student) => sum + student.totalAnswered, 0);
    const classAnalytics = {
        totalStudents: players.length,
        totalQuestions,
        averageScore: players.length > 0 ? 
            Math.round((Object.values(room.players).reduce((sum, player) => sum + player.points, 0) / players.length) * 100) / 100 : 0,
        averageAccuracy: studentAnalytics.length > 0 ?
            Math.round((studentAnalytics.reduce((sum, student) => sum + student.accuracy, 0) / studentAnalytics.length) * 100) / 100 : 0,
        questionsNeedingReview: questionAnalytics.filter(q => q.needsReview).length,
        studentsNeedingAttention: studentAnalytics.filter(s => s.needsAttention).length,
        participationRate: players.length > 0 && totalQuestions > 0 ? 
            Math.round((totalAnsweredQuestions / (players.length * totalQuestions)) * 100) : 0
    };
    
    return {
        classAnalytics,
        questionAnalytics,
        studentAnalytics
    };
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
            currentQuestion: {}, startTime: 0, questionHistory: [], locked: false
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
            room.players[socket.id] = {name: sanitizedName, character: data.character, points: 0};
            
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
                    points: existingPlayerData.points
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
                    const activePlayers = getActivePlayers(room, io);
                    io.to(room.host).emit('ACTIVE_PLAYER_COUNT', {
                        active: Object.keys(activePlayers).length,
                        total: Object.keys(room.players).length,
                        expectedAnswers: Object.keys(activePlayers).length
                    });
                }
            } else {
                room.players[socket.id] = {
                    name: session.playerData.name,
                    character: session.playerData.character,
                    points: session.playerData.points || 0
                };
                
                io.to(room.host).emit('PLAYER_JOINED', {
                    id: socket.id,
                    name: session.playerData.name,
                    character: session.playerData.character
                });
            }            const gameState = {
                roomState: room.state,
                currentQuestion: room.currentQuestion,
                playerPoints: room.players[socket.id].points,
                roomCode: session.roomCode,
                playerData: session.playerData
            };
            
            if (room.state === 'ingame' && room.currentQuestion && !room.currentQuestion.isCompleted) {
                let questionType = room.currentQuestion.type;
                if (room.currentQuestion.type === 'multiple-choice') {
                    const isMultipleChoice = room.currentQuestion.answers.filter(answer => answer.is_correct).length > 1;
                    questionType = isMultipleChoice ? 'multiple' : 'single';
                }

                const questionData = { type: questionType, title: room.currentQuestion.title };

                if (room.currentQuestion.type === 'text') {
                    questionData.maxLength = 200;
                } else if (room.currentQuestion.type === 'sequence') {
                    const originalQuestion = room.questionHistory[room.questionHistory.length - 1];
                    questionData.answers = originalQuestion?.shuffledAnswers || room.currentQuestion.answers.length;
                } else {
                    questionData.answers = room.currentQuestion.answers.length;
                }
                
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
                     data.answers.map(answer => {
                         const {content, ...rest} = answer;
                         return rest;
                     }),
            isCompleted: false,
            answersReady: false
        };

        room.questionHistory.push({
            title: data.title,
            type: data.type,
            pointMultiplier: data.pointMultiplier,
            answers: data.answers,
            shuffledAnswers: data.type === 'sequence' ? [...data.answers]
                .map((answer, index) => ({
                    content: answer.content,
                    type: answer.type || 'text',
                    originalIndex: index
                }))
                .sort(() => Math.random() - 0.5) : undefined
        });

        room.playerAnswers.push({});

        let questionType = data.type;
        if (data.type === 'multiple-choice') {
            const isMultipleChoice = data.answers.filter(answer => answer.is_correct).length > 1;
            questionType = isMultipleChoice ? 'multiple' : 'single';
        }

        const questionData = { type: questionType, title: data.title };

        if (data.type === 'text') {
            questionData.maxLength = 200;
        } else if (data.type === 'sequence') {
            const currentQuestionHistory = room.questionHistory[room.questionHistory.length - 1];
            questionData.answers = currentQuestionHistory.shuffledAnswers;
        } else {
            questionData.answers = data.answers.length;
        }

        io.to(currentRoomCode.toString()).emit('QUESTION_RECEIVED', questionData);

        const activePlayers = getActivePlayers(room, io);
        io.to(room.host).emit('ACTIVE_PLAYER_COUNT', {
            active: Object.keys(activePlayers).length,
            total: Object.keys(room.players).length,
            expectedAnswers: Object.keys(activePlayers).length
        });

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

        playerAnswers[playerAnswers.length - 1][socket.id] = data.answers;

        let correctAnswers = 0;
        const currentQuestion = room.currentQuestion;

        if (currentQuestion.type === 'text') {
            const userAnswer = data.answers.toLowerCase().trim();
            const correctTextAnswers = currentQuestion.answers.map(a => a.content.toLowerCase().trim());
            correctAnswers = correctTextAnswers.includes(userAnswer) ? 1 : 0;
        } else if (currentQuestion.type === 'sequence') {
            const sequenceResult = validateSequenceAnswer(data.answers, currentQuestion);
            correctAnswers = sequenceResult.score;
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

        const points = calculatePoints(correctAnswers, room, currentQuestion.pointMultiplier);
        room.players[socket.id].points += points;

        const currentAnswers = playerAnswers[playerAnswers.length - 1];
        const activePlayers = getActivePlayers(room, io);
        
        if (Object.keys(currentAnswers).length === Object.keys(activePlayers).length) {
            const answerData = generateAnswerData(currentQuestion, currentAnswers, room);
            room.currentQuestion.isCompleted = true;

            broadcastAnswerResults(io, currentRoomCode, answerData, room);

            io.to(room.host).emit('ANSWERS_RECEIVED', {
                answers: currentAnswers,
                scoreboard: room.players,
                answerData: answerData,
                activePlayerCount: Object.keys(activePlayers).length,
                totalPlayerCount: Object.keys(room.players).length,
                allActiveAnswered: true
            });
        } else {
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
        const analytics = generateAnalyticsData(room);
        
        callback({
            playerAnswers: room.playerAnswers, 
            players: room.players,
            analytics: analytics
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
                const activePlayers = getActivePlayers(room, io);
                const currentAnswers = room.playerAnswers[room.playerAnswers.length - 1];
                
                io.to(room.host).emit('ACTIVE_PLAYER_COUNT', {
                    active: Object.keys(activePlayers).length,
                    total: Object.keys(room.players).length,
                    expectedAnswers: Object.keys(activePlayers).length
                });
                
                if (Object.keys(currentAnswers).length === Object.keys(activePlayers).length && Object.keys(activePlayers).length > 0) {
                    const answerData = generateAnswerData(room.currentQuestion, currentAnswers, room);
                    room.currentQuestion.isCompleted = true;
                    broadcastAnswerResults(io, currentRoomCode, answerData, room);
                    io.to(room.host).emit('ANSWERS_RECEIVED', {
                        answers: currentAnswers,
                        scoreboard: room.players,
                        answerData: answerData,
                        activePlayerCount: Object.keys(activePlayers).length,
                        totalPlayerCount: Object.keys(room.players).length,
                        allActiveAnswered: true
                    });
                }
            }
        }
    });
};