import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {Server} from 'socket.io';
import {io} from 'socket.io-client';
import registerSocket from '../../server/socket.js';

const request = (socket, event, data = {}) => socket.timeout(2000).emitWithAck(event, data);

const createGame = async t => {
    const httpServer = createServer();
    const server = new Server(httpServer, {path: '/api/ws'});
    server.on('connection', socket => registerSocket(server, socket));
    httpServer.listen(0, '127.0.0.1');
    await once(httpServer, 'listening');
    const clients = [];
    const connect = async () => {
        const client = io(`http://127.0.0.1:${httpServer.address().port}`, {
            path: '/api/ws', transports: ['websocket'], forceNew: true,
            autoConnect: false, reconnection: false
        });
        clients.push(client);
        client.connect();
        await once(client, 'connect');
        return client;
    };
    t.after(async () => {
        clients.forEach(client => client.disconnect());
        await new Promise(resolve => server.close(resolve));
    });

    const host = await connect();
    const code = await request(host, 'CREATE_ROOM', {settings: {scoringMode: 'flat'}});
    const student = await connect();
    const joined = await request(student, 'JOIN_ROOM', {code, name: 'Alice', character: 'wizard'});
    assert.equal(joined.success, true);
    return {host, student, code, sessionId: joined.sessionId, connect};
};

const addClassmate = async game => {
    const classmate = await game.connect();
    const response = await request(classmate, 'JOIN_ROOM', {code: game.code, name: 'Bob', character: 'wizard'});
    assert.equal(response.success, true);
    return classmate;
};

const showQuestion = async (game, question) => {
    const ready = once(game.student, 'ANSWERS_READY');
    const response = await request(game.host, 'SHOW_QUESTION', question);
    assert.equal(response.success, true);
    await ready;
};

const choiceQuestion = {
    title: 'Two plus two?', type: 'multiple-choice',
    answers: [
        {type: 'text', content: '4', is_correct: true},
        {type: 'text', content: '5', is_correct: false}
    ]
};

test('a returning student rejoins a locked lobby with the same identity', async t => {
    const game = await createGame(t);
    const oldId = game.student.id;
    await request(game.host, 'LOCK_ROOM');
    game.student.disconnect();
    const student = await game.connect();
    const restored = await request(student, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});

    assert.equal(restored.success, true);
    assert.notEqual(student.id, oldId);
    assert.equal(restored.gameState.roomCode, game.code);
    assert.equal(restored.gameState.roomState, 'waiting');
    assert.equal(restored.gameState.playerData.name, 'Alice');
    assert.equal(restored.gameState.currentQuestion, null);
    assert.equal(restored.gameState.totalPlayers, 1);
});

test('rejoining restores the current question, submitted answers, score and completed results', async t => {
    const game = await createGame(t);
    const classmate = await addClassmate(game);
    await showQuestion(game, choiceQuestion);
    game.student.disconnect();

    // No question listeners are mounted yet: the acknowledgement must contain
    // everything needed to render after navigation from the home page.
    const student = await game.connect();
    const restored = await request(student, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(restored.success, true);
    assert.deepEqual(restored.gameState.currentQuestion, {title: choiceQuestion.title, type: 'single', answers: 2});
    assert.equal(restored.gameState.answersReady, true);
    assert.equal(restored.gameState.hasAnswered, false);
    assert.equal(restored.gameState.answerData, null);
    assert.equal(restored.gameState.totalPlayers, 2);

    assert.equal((await request(student, 'SUBMIT_ANSWER', {answers: [0]})).success, true);
    const sameSocket = await request(student, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(sameSocket.gameState.hasAnswered, true);
    assert.deepEqual(sameSocket.gameState.submittedAnswer, [0]);
    assert.equal(sameSocket.gameState.playerPoints, 100);
    assert.equal((await request(student, 'SUBMIT_ANSWER', {answers: [0]})).success, false);

    student.disconnect();
    const returned = await game.connect();
    const migrated = await request(returned, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.deepEqual(migrated.gameState.submittedAnswer, [0]);
    assert.equal(migrated.gameState.playerPoints, 100);
    assert.equal(migrated.gameState.streak, 1);
    assert.equal(migrated.gameState.questionCompleted, false);

    await request(classmate, 'SUBMIT_ANSWER', {answers: [1]});
    returned.disconnect();
    const resultClient = await game.connect();
    const result = await request(resultClient, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(result.gameState.questionCompleted, true);
    assert.deepEqual(result.gameState.answerData.answers, [true, false]);
    assert.equal(result.gameState.playerPoints, 100);
    assert.equal(result.gameState.pointsEarned, 100);
    assert.equal(result.gameState.rank, 1);

    await request(game.host, 'END_GAME');
    const endedClient = await game.connect();
    const ended = await request(endedClient, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(ended.success, false);
    assert.equal(ended.sessionInvalid, true);
});

for (const {question, answer} of [
    {question: {title: 'Choose zero', type: 'slider', answers: [{min: 0, max: 10, correctValue: 0}]}, answer: 0},
    {question: {title: 'Name a city', type: 'text', answers: [{content: 'Berlin'}]}, answer: ''}
]) {
    test(`reconnecting preserves a ${question.type} answer of ${JSON.stringify(answer)}`, async t => {
        const game = await createGame(t);
        await addClassmate(game);
        await showQuestion(game, question);
        assert.equal((await request(game.student, 'SUBMIT_ANSWER', {answers: answer})).success, true);

        const restored = await request(game.student, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
        assert.equal(restored.gameState.hasAnswered, true);
        assert.equal(restored.gameState.submittedAnswer, answer);
        assert.equal(restored.gameState.answerData, null);
        assert.equal(JSON.stringify(restored.gameState.currentQuestion).includes('correctValue'), false);
        assert.equal(JSON.stringify(restored.gameState.currentQuestion).includes('Berlin'), false);
        assert.equal((await request(game.student, 'SUBMIT_ANSWER', {answers: answer})).success, false);
    });
}

test('a removed student cannot resume the saved questionnaire', async t => {
    const game = await createGame(t);
    const playerId = game.student.id;
    game.student.disconnect();
    assert.equal(await request(game.host, 'KICK_PLAYER', {id: playerId}), true);
    const returning = await game.connect();
    const response = await request(returning, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(response.success, false);
    assert.equal(response.sessionInvalid, true);
});

test('a question stays available when every student disconnects', async t => {
    const game = await createGame(t);
    await request(game.host, 'SHOW_QUESTION', choiceQuestion);
    game.student.disconnect();
    const returning = await game.connect();
    const restored = await request(returning, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(restored.success, true);
    assert.equal(restored.gameState.questionCompleted, false);
    assert.equal(restored.gameState.currentQuestion.title, choiceQuestion.title);
});

test('a returning student receives the latest question and keeps their earlier answers', async t => {
    const game = await createGame(t);
    await addClassmate(game);
    await showQuestion(game, choiceQuestion);
    await request(game.student, 'SUBMIT_ANSWER', {answers: [0]});
    await request(game.host, 'SKIP_QUESTION');
    game.student.disconnect();
    await request(game.host, 'SHOW_QUESTION', {title: 'Next question', type: 'text', answers: [{content: 'Berlin'}]});

    const returning = await game.connect();
    const restored = await request(returning, 'RECONNECT_WITH_SESSION', {sessionId: game.sessionId});
    assert.equal(restored.gameState.currentQuestion.title, 'Next question');
    assert.equal(restored.gameState.hasAnswered, false);
    assert.equal(restored.gameState.playerPoints, 100);
    const results = await request(game.host, 'END_GAME');
    assert.deepEqual(results.playerAnswers[0][returning.id], [0]);
    assert.equal(Object.keys(results.players).length, 2);
});
