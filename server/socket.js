const {generateRoomCode, isAlphabeticCode} = require("./utils/random");
const {validateSchemaSocket} = require("./utils/error");
const {checkRoom, joinRoom, answerQuestion} = require("./validations/socket");
const {questionValidation} = require("./validations/quiz");
const {
    createSession,
    getSession,
    updateSessionSocket,
    invalidateSession,
    cleanupRoomSessions,
    getSessionBySocketId
} = require("./utils/session");

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
        io.sockets.sockets.get(player)?.disconnect();
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
            currentQuestion: {}, startTime: 0, questionHistory: []
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
            
            const sessionToken = createSession(socket.id, data.code, {
                name: sanitizedName,
                character: data.character
            });
            
            io.to(room.host).emit('PLAYER_JOINED', {id: socket.id, name: sanitizedName, character: data.character});
            currentRoomCode = data.code;
            callback({success: true, sessionToken});
        } else {
            callback({success: false, error: 'Raum existiert nicht oder Spiel hat bereits begonnen'});
        }
    });

    socket.on('RECONNECT_SESSION', (data, callback) => {
        if (!validateCallback(callback)) return;
        
        const {token, roomCode, playerData} = data;
        
        if (!token || !roomCode || !playerData) {
            return callback({success: false, error: 'Ungültige Sitzungsdaten'});
        }
        
        const session = getSession(token);
        if (!session) {
            return callback({success: false, error: 'Sitzung abgelaufen oder ungültig'});
        }
        
        const room = rooms[roomCode];
        if (!room) {
            invalidateSession(token);
            return callback({success: false, error: 'Raum nicht mehr verfügbar'});
        }

        let existingPlayerId = null;
        let existingPlayerData = null;
        
        for (const [playerId, player] of Object.entries(room.players)) {
            if (player.name === playerData.name) {
                existingPlayerId = playerId;
                existingPlayerData = player;
                break;
            }
        }

        if (updateSessionSocket(token, socket.id)) {
            socket.join(roomCode.toString());
            currentRoomCode = roomCode;
            
            if (existingPlayerId && existingPlayerData) {
                delete room.players[existingPlayerId];
                
                room.players[socket.id] = {
                    name: existingPlayerData.name,
                    character: existingPlayerData.character,
                    points: existingPlayerData.points
                };

                if (room.playerAnswers && room.playerAnswers.length > 0) {
                    room.playerAnswers.forEach(questionAnswers => {
                        if (questionAnswers[existingPlayerId] !== undefined) {
                            questionAnswers[socket.id] = questionAnswers[existingPlayerId];
                            delete questionAnswers[existingPlayerId];
                        }
                    });
                }
                
                console.log(`Player ${playerData.name} reconnected: ${existingPlayerId} -> ${socket.id}`);

                io.to(room.host).emit('PLAYER_RECONNECTED', {
                    id: socket.id,
                    name: playerData.name,
                    character: playerData.character,
                    oldId: existingPlayerId
                });
            } else {
                room.players[socket.id] = {
                    name: playerData.name,
                    character: playerData.character,
                    points: session.playerData.points || 0
                };
                
                io.to(room.host).emit('PLAYER_JOINED', {
                    id: socket.id,
                    name: playerData.name,
                    character: playerData.character
                });
            }

            const gameState = {
                roomState: room.state,
                currentQuestion: room.currentQuestion,
                playerPoints: room.players[socket.id].points
            };
            
            if (room.state === 'ingame' && room.currentQuestion && !room.currentQuestion.isCompleted) {
                let questionType = room.currentQuestion.type;
                if (room.currentQuestion.type === 'multiple-choice') {
                    const isMultipleChoice = room.currentQuestion.answers.filter(answer => answer.is_correct).length > 1;
                    questionType = isMultipleChoice ? 'multiple' : 'single';
                }

                const questionData = {
                    type: questionType,
                    title: room.currentQuestion.title
                };

                if (room.currentQuestion.type === 'text') {
                    questionData.maxLength = 200;
                } else {
                    questionData.answers = room.currentQuestion.answers.length;
                }
                
                socket.emit('QUESTION_RECEIVED', questionData);

                if (room.currentQuestion.answersReady) {
                    socket.emit('ANSWERS_READY', true);
                }
            }

            socket.emit('GAME_STATE_RESTORED', gameState);
            
            callback({success: true, gameState});
        } else {
            callback({success: false, error: 'Fehler beim Wiederherstellen der Sitzung'});
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
            isCompleted: false,
            answersReady: false
        };

        room.questionHistory.push({
            title: data.title,
            type: data.type,
            answers: data.answers
        });

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

        setTimeout(() => {
            if (rooms[currentRoomCode] && rooms[currentRoomCode].currentQuestion) {
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
                invalidateSession(session.token);
            }
            return;
        }

        const room = rooms[currentRoomCode];

        if (room.host === socket.id) {
            endGameForAllPlayers(io, room, currentRoomCode);
            return;
        }

        if (room.players[socket.id]) {
            const session = getSessionBySocketId(socket.id);
            if (session) {
                session.playerData.points = room.players[socket.id].points;
                session.playerData.name = room.players[socket.id].name;
                session.playerData.character = room.players[socket.id].character;
                console.log(`Player ${room.players[socket.id].name} disconnected but session preserved for reconnection`);
            }

            const playerName = room.players[socket.id].name;

            io.to(room.host).emit('PLAYER_DISCONNECTED', {
                id: socket.id,
                name: playerName,
                temporary: true
            });
        }
    });
};