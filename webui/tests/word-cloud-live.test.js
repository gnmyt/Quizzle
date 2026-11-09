import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mock, test} from 'node:test';
import {Server} from 'socket.io';
import {io} from 'socket.io-client';

// Keep the application's background session-cleanup interval inside the test
// clock; connection and question timers continue to use real time.
mock.timers.enable({apis: ['setInterval']});
const {default: registerSocket} = await import('../../server/socket.js');
mock.timers.reset();

const request = (socket, event, data = {}) => socket.timeout(2000).emitWithAck(event, data);
const createGame = async t => {
    const http = createServer();
    const server = new Server(http, {path: '/api/ws'});
    server.on('connection', socket => registerSocket(server, socket));
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const clients = [];
    const connect = async () => {
        const socket = io(`http://127.0.0.1:${http.address().port}`, {
            path: '/api/ws', transports: ['websocket'], autoConnect: false, reconnection: false
        });
        clients.push(socket);
        socket.connect();
        await once(socket, 'connect');
        return socket;
    };
    t.after(async () => {
        clients.forEach(socket => socket.disconnect());
        await new Promise(resolve => server.close(resolve));
    });
    const host = await connect();
    const code = await request(host, 'CREATE_ROOM', {settings: {scoringMode: 'flat'}});
    const students = [];
    for (const name of ['Alice', 'Bob']) {
        const student = await connect();
        assert.equal((await request(student, 'JOIN_ROOM', {code, name, character: 'wizard'})).success, true);
        students.push(student);
    }
    return {host, students};
};

const showQuestion = async (game, question) => {
    const ready = once(game.students[0], 'ANSWERS_READY');
    assert.equal((await request(game.host, 'SHOW_QUESTION', question)).success, true);
    await ready;
};

test('live word clouds update, group typos, reject duplicate answers and preserve scores and streaks', async t => {
    const game = await createGame(t);
    await showQuestion(game, {title: 'Capital?', type: 'text', answers: [{content: 'Berlin'}]});
    for (const student of game.students) await request(student, 'SUBMIT_ANSWER', {answers: 'Berlin'});
    const payloadPromise = once(game.students[0], 'QUESTION_RECEIVED');
    await showQuestion(game, {title: 'Your ideas?', type: 'word-cloud', answers: [], pointMultiplier: 'double'});
    const [payload] = await payloadPromise;
    assert.equal(payload.type, 'word-cloud');
    assert.equal(payload.maxLength, 40);

    for (const answer of ['', ' ', [], 12, 'a'.repeat(41)]) {
        assert.equal((await request(game.students[0], 'SUBMIT_ANSWER', {answers: answer})).success, false);
    }
    const liveUpdate = once(game.host, 'WORD_CLOUD_UPDATED');
    assert.equal((await request(game.students[0], 'SUBMIT_ANSWER', {answers: ' Climate '})).success, true);
    const [live] = await liveUpdate;
    assert.equal(live.totalResponses, 1);
    assert.equal(live.words[0].text, 'Climate');
    assert.equal((await request(game.students[0], 'SUBMIT_ANSWER', {answers: 'Another idea'})).success, false);

    const finalResult = once(game.students[0], 'ANSWER_RECEIVED');
    const pointsResult = once(game.students[0], 'POINTS_RECEIVED');
    await request(game.students[1], 'SUBMIT_ANSWER', {answers: 'climtae'});
    const [cloud] = await finalResult;
    assert.equal(cloud.type, 'word-cloud');
    assert.equal(cloud.totalResponses, 2);
    assert.equal(cloud.words.length, 2);
    assert.equal(cloud.words[0].group, cloud.words[1].group);
    const [points] = await pointsResult;
    assert.equal(points.points, 100);
    assert.equal(points.pointsEarned, 0);
    assert.equal(points.streak, 1);
    const ended = await request(game.host, 'END_GAME');
    assert.equal(ended.analytics.studentAnalytics[0].accuracy, 100);
    assert.equal(ended.analytics.questionAnalytics[1].ungraded, true);
});

test('the host can finish a word cloud without any submissions', async t => {
    const game = await createGame(t);
    await request(game.host, 'SHOW_QUESTION', {title: 'Any ideas?', type: 'word-cloud', answers: []});
    const result = await request(game.host, 'SKIP_QUESTION');
    assert.equal(result.answerData.type, 'word-cloud');
    assert.equal(result.answerData.totalResponses, 0);
    assert.deepEqual(result.answerData.words, []);
});
