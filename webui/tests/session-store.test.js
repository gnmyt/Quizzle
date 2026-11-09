import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(import.meta.url);

test('student sessions remain available until the room ends or the player is removed', t => {
    t.mock.timers.enable({apis: ['Date', 'setInterval'], now: Date.now()});
    const {createSession, getSession, markSessionDisconnected, invalidateSession, cleanupRoomSessions} =
        require('../../server/utils/session.js');
    const roomCode = 1234;
    const disconnected = createSession('student-1', roomCode, {name: 'Alice'});
    const connected = createSession('student-2', roomCode, {name: 'Bob'});
    markSessionDisconnected(disconnected);

    t.mock.timers.tick(2 * 60 * 60 * 1000);
    assert.ok(getSession(disconnected), 'a closed browser must not lose its place after five minutes');
    assert.ok(getSession(connected), 'an active questionnaire must not expire after an hour');

    invalidateSession(disconnected);
    assert.equal(getSession(disconnected), null, 'removed students cannot rejoin');
    cleanupRoomSessions(roomCode);
    assert.equal(getSession(connected), null, 'ended questionnaires cannot be resumed');
});
