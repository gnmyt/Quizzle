import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const sessionKey = 'quizzle_session_id';
const source = readFileSync(new URL('../src/common/utils/SocketUtil.js', import.meta.url), 'utf8')
    .replace("import {io} from 'socket.io-client';", '')
    .replace(/^export /gm, '');

const createClient = (storage = new Map()) => {
    class Socket extends EventEmitter {
        connected = false;
        requests = [];
        emit(event, data, callback) {
            this.requests.push({event, data, callback});
            return this;
        }
        timeout(milliseconds) {
            this.ackTimeout = milliseconds;
            return this;
        }
        receive(event, ...args) {
            return super.emit(event, ...args);
        }
        connect() {
            this.connected = true;
            this.receive('connect');
            return this;
        }
        disconnect(reason = 'transport close') {
            this.connected = false;
            this.receive('disconnect', reason);
        }
    }
    const socket = new Socket();
    const timers = new Map();
    let nextTimer = 0;
    const context = {
        io: () => socket, console,
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        setTimeout: (callback, delay) => {
            const id = ++nextTimer;
            timers.set(id, {callback, delay});
            return id;
        },
        clearTimeout: id => timers.delete(id)
    };
    const api = runInNewContext(`${source}\n({restoreSession, joinRoomWithSession, addReconnectionCallback, getSessionManager})`, context);
    return {socket, storage, timers, ...api};
};

test('saved sessions reconnect automatically and concurrent restores share one request', async () => {
    const client = createClient(new Map([[sessionKey, 'saved-session']]));
    const notifications = [];
    client.addReconnectionCallback((...args) => notifications.push(args));
    client.socket.connect();
    const first = client.restoreSession();
    const second = client.restoreSession();
    await Promise.resolve();

    assert.equal(client.socket.requests.length, 1);
    assert.equal(client.socket.requests[0].data.sessionId, 'saved-session');
    assert.equal(client.socket.ackTimeout, 10000);
    const gameState = {roomCode: 1234, playerPoints: 100};
    client.socket.requests[0].callback(null, {success: true, gameState});
    assert.equal(await first, gameState);
    assert.equal(await second, gameState);
    assert.deepEqual(notifications, [[true, null, gameState]]);
});

test('repeated acknowledgement timeouts preserve the session and keep retrying', () => {
    const client = createClient(new Map([[sessionKey, 'saved-session']]));
    client.socket.connect();
    for (let attempt = 0; attempt < 7; attempt++) {
        client.socket.requests.at(-1).callback(new Error('acknowledgement timed out'));
        assert.equal(client.storage.get(sessionKey), 'saved-session');
        assert.equal(client.timers.size, 1);
        const [id, timer] = client.timers.entries().next().value;
        assert.ok(timer.delay <= 10000);
        client.timers.delete(id);
        timer.callback();
    }
    assert.equal(client.socket.requests.length, 8);
    client.socket.requests.at(-1).callback(null, {success: true, gameState: {roomCode: 1234}});
    assert.equal(client.timers.size, 0);
    assert.equal(client.getSessionManager().hasValidSession(), true);
});

test('disconnecting during restoration allows a new attempt and ignores the old reply', () => {
    const client = createClient(new Map([[sessionKey, 'saved-session']]));
    const notifications = [];
    client.addReconnectionCallback((...args) => notifications.push(args));
    client.socket.connect();
    const interrupted = client.socket.requests[0];
    client.socket.disconnect();
    client.socket.connect();
    assert.equal(client.socket.requests.length, 2);

    interrupted.callback(null, {sessionInvalid: true});
    assert.equal(client.storage.get(sessionKey), 'saved-session');
    const gameState = {roomCode: 1234};
    client.socket.requests[1].callback(null, {success: true, gameState});
    assert.deepEqual(notifications.at(-1), [true, null, gameState]);
});

test('invalid sessions clear the saved token and do not retry', () => {
    const client = createClient(new Map([[sessionKey, 'ended-session']]));
    client.socket.connect();
    client.socket.requests[0].callback(null, {success: false, sessionInvalid: true});
    assert.equal(client.storage.has(sessionKey), false);
    assert.equal(client.getSessionManager().hasValidSession(), false);
    assert.equal(client.timers.size, 0);
});

test('reopening the browser resumes the last joined questionnaire', async () => {
    const storage = new Map([[sessionKey, 'old-questionnaire']]);
    const client = createClient(storage);
    client.socket.connect();
    const previousRestore = client.socket.requests[0];
    const joining = client.joinRoomWithSession(5678, 'Alice', 'wizard');
    await Promise.resolve();
    const joinRequest = client.socket.requests.at(-1);
    assert.equal(joinRequest.event, 'JOIN_ROOM');
    joinRequest.callback({success: true, sessionId: 'last-questionnaire'});
    await joining;
    previousRestore.callback(null, {success: false, sessionInvalid: true});
    assert.equal(storage.get(sessionKey), 'last-questionnaire');

    const reopened = createClient(storage);
    reopened.socket.connect();
    assert.equal(reopened.socket.requests[0].data.sessionId, 'last-questionnaire');
    reopened.socket.receive('GAME_ENDED');
    assert.equal(storage.has(sessionKey), false);
});

test('a visitor without a saved session does not attempt to restore one', async () => {
    const client = createClient();
    assert.equal(await client.restoreSession(), null);
    assert.equal(client.socket.connected, false);
    assert.equal(client.socket.requests.length, 0);
});
