const {generateRoomCode} = require("./utils/random");
const {validateSchemaSocket} = require("./utils/error");
const {checkRoom, joinRoom, answerQuestion} = require("./validations/socket");
const {questionValidation} = require("./validations/quiz");

const rooms = {};

const calculatePoints = (correctAnswers, room) => {
    const basePoints = 100;
    const maxTime = 30000;
    const timeTaken = Math.min(maxTime, Date.now() - room.startTime);
    const timeFactor = 1 - timeTaken / maxTime;

    return correctAnswers >= 1 ? Math.round(basePoints * timeFactor + ( correctAnswers * basePoints)) : 0;
}

module.exports = (io, socket) => {
    let currentRoomCode;

    socket.on('CREATE_ROOM', (data, callback) => {
        if (!callback) return;
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
        if (!callback) return;
        if (!data?.id) return callback(false);
        if (rooms[currentRoomCode]?.host !== socket.id) return callback(false);
        if (!rooms[currentRoomCode].players[data.id]) return callback(false);
        if (rooms[currentRoomCode].state !== 'waiting') return callback(false);

        io.to(rooms[currentRoomCode].host).emit('PLAYER_LEFT', {id: data.id, name: rooms[currentRoomCode].players[data.id].name});
        io.sockets.sockets.get(data.id)?.disconnect();

        delete rooms[currentRoomCode].players[data.id];
        callback(true);
    });

    socket.on('CHECK_ROOM', (data, callback) => {
        if (!callback) return;
        const validationResult = validateSchemaSocket(null, checkRoom, data);
        if (validationResult) {
            callback({ success: false, error: validationResult.details[0].message });
            return;
        }
        callback({ success: true, exists: !!rooms[data.code] });
    });

    socket.on('JOIN_ROOM', (data, callback) => {
        if (!callback) return;
        const validationResult = validateSchemaSocket(null, joinRoom, data);
        if (validationResult) {
            callback({ success: false, error: validationResult.details[0].message });
            return;
        }

        const room = rooms[data.code];
        if (room && room.state === 'waiting' && !room.players[socket.id]) {
            const { value } = joinRoom.validate(data);
            const sanitizedName = value.name;
            
            const existingNames = Object.values(room.players).map(p => p.name.toLowerCase());
            if (existingNames.includes(sanitizedName.toLowerCase())) {
                callback({ success: false, error: 'Dieser Name ist bereits vergeben' });
                return;
            }
            
            socket.join(data.code.toString());
            room.players[socket.id] = {name: sanitizedName, character: data.character, points: 0};
            io.to(room.host).emit('PLAYER_JOINED', {id: socket.id, name: sanitizedName, character: data.character});
            currentRoomCode = data.code;
            callback({ success: true });
        } else {
            callback({ success: false, error: 'Raum existiert nicht oder Spiel hat bereits begonnen' });
        }
    });

    socket.on('SHOW_QUESTION', (data, callback) => {
        if (!callback) return;
        if (!rooms[currentRoomCode]) return callback({ success: false, error: 'Raum nicht gefunden' });
        if (rooms[currentRoomCode].host !== socket.id) return callback({ success: false, error: 'Nicht autorisiert' });

        const validationResult = validateSchemaSocket(null, questionValidation, data);
        if (validationResult) {
            callback({ success: false, error: validationResult.details[0].message });
            return;
        }

        rooms[currentRoomCode].state = 'ingame';

        rooms[currentRoomCode].currentQuestion = {
            title: data.title, answers: data.answers.map(answer => {
                const {content, ...rest} = answer;
                return rest;
            })
        };

        rooms[currentRoomCode].playerAnswers.push({});

        const isMultipleChoice = data.answers.filter(answer => answer.is_correct).length > 1;

        io.to(currentRoomCode.toString()).emit('QUESTION_RECEIVED', {
            type: isMultipleChoice ? 'multiple' : 'single',
            answers: data.answers.length,
            title: data.title
        });
        rooms[currentRoomCode].startTime = Date.now();
        callback({ success: true });
    });

    socket.on('SUBMIT_ANSWER', (data, callback) => {
        if (!callback) return;
        if (!rooms[currentRoomCode]?.players[socket.id]) return callback({ success: false, error: 'Spieler nicht im Raum' });

        const playerAnswers = rooms[currentRoomCode].playerAnswers;
        if (playerAnswers[playerAnswers.length - 1][socket.id]) return callback({ success: false, error: 'Antwort bereits abgegeben' });
        
        const validationResult = validateSchemaSocket(null, answerQuestion, data);
        if (validationResult) {
            callback({ success: false, error: validationResult.details[0].message });
            return;
        }

        playerAnswers[playerAnswers.length - 1][socket.id] = data.answers;

        let correctAnswers = 0;
        for (const answer of data.answers) {
            correctAnswers += rooms[currentRoomCode].currentQuestion.answers[answer].is_correct ? 1 : -1;
        }

        if (correctAnswers < 0) correctAnswers = 0;

        const points = calculatePoints(correctAnswers, rooms[currentRoomCode]);
        rooms[currentRoomCode].players[socket.id].points += points;

        if (Object.keys(playerAnswers[playerAnswers.length - 1]).length === Object.keys(rooms[currentRoomCode].players).length) {
            io.to(rooms[currentRoomCode].host).emit('ANSWERS_RECEIVED', {answers: playerAnswers[playerAnswers.length - 1],
                scoreboard: rooms[currentRoomCode].players});
        }

        callback({ success: true });
    });

    socket.on('SKIP_QUESTION', (data, callback) => {
        if (!callback) return;
        if (rooms[currentRoomCode]?.host !== socket.id) return callback(false);
        if (rooms[currentRoomCode].state !== 'ingame') return callback(false);

        const playerAnswers = rooms[currentRoomCode].playerAnswers;

        io.to(currentRoomCode.toString()).emit('ANSWER_RECEIVED', {answers: rooms[currentRoomCode].currentQuestion.
            answers.map(answer => answer.is_correct)});

        for (const player of Object.keys(rooms[currentRoomCode].players)) {
            io.to(player).emit("POINTS_RECEIVED", rooms[currentRoomCode].players[player].points);
        }

        callback( {answers: playerAnswers[playerAnswers.length - 1],
            scoreboard: rooms[currentRoomCode].players});
    });

    socket.on('END_GAME', (data, callback) => {
        if (!callback) return;
        if (rooms[currentRoomCode]?.host !== socket.id) return callback(false);
        if (rooms[currentRoomCode].state !== 'ingame') return callback(false);

        callback({playerAnswers: rooms[currentRoomCode].playerAnswers, players: rooms[currentRoomCode].players});

        for (const player of Object.keys(rooms[currentRoomCode].players)) {
            io.to(player).emit("GAME_ENDED", rooms[currentRoomCode].playerAnswers.filter(answer => answer[player]));
            io.sockets.sockets.get(player)?.disconnect();
        }

        delete rooms[currentRoomCode];
    });

    socket.on('disconnect', () => {
        if (rooms[currentRoomCode]?.host === socket.id) {
            for (const player of Object.keys(rooms[currentRoomCode].players)) {
                io.to(player).emit("GAME_ENDED", rooms[currentRoomCode].playerAnswers.filter(answer => answer[player]));
                io.sockets.sockets.get(player)?.disconnect();
            }
            delete rooms[currentRoomCode];

            return;
        }

        if (rooms[currentRoomCode]?.players[socket.id]) {
            io.to(rooms[currentRoomCode].host).emit('PLAYER_LEFT', {id: socket.id, name: rooms[currentRoomCode].players[socket.id].name});
            delete rooms[currentRoomCode].players[socket.id];
        }
    });
};