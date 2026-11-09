const crypto = require('crypto');

const sessions = new Map();
const sessionsByRoom = new Map();

const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const createSession = (socketId, roomCode, playerData) => {
    const token = generateSessionToken();
    const session = {
        token,
        socketId,
        roomCode,
        playerData,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
        status: 'connected',
        disconnectedAt: null,
        reconnectCount: 0
    };
    
    sessions.set(token, session);
    
    if (!sessionsByRoom.has(roomCode)) {
        sessionsByRoom.set(roomCode, new Set());
    }
    sessionsByRoom.get(roomCode).add(token);
    
    return token;
};

const getSession = (token) => {
    const session = sessions.get(token);
    if (session && session.isActive) {
        session.lastActivity = Date.now();
        return session;
    }
    return null;
};

const updateSessionSocket = (token, newSocketId) => {
    const session = sessions.get(token);
    if (session && session.isActive) {
        session.socketId = newSocketId;
        session.lastActivity = Date.now();
        session.status = 'connected';
        session.disconnectedAt = null;
        session.reconnectCount += 1;
        return true;
    }
    return false;
};

const invalidateSession = (token) => {
    const session = sessions.get(token);
    if (session) {
        session.isActive = false;
        session.status = 'invalid';
        sessions.delete(token);

        if (sessionsByRoom.has(session.roomCode)) {
            sessionsByRoom.get(session.roomCode).delete(token);
            if (sessionsByRoom.get(session.roomCode).size === 0) {
                sessionsByRoom.delete(session.roomCode);
            }
        }
        return true;
    }
    return false;
};

const markSessionDisconnected = (token) => {
    const session = sessions.get(token);
    if (session && session.isActive) {
        session.status = 'disconnected';
        session.disconnectedAt = Date.now();
        session.lastActivity = Date.now();
        return true;
    }
    return false;
};

const cleanupRoomSessions = (roomCode) => {
    if (sessionsByRoom.has(roomCode)) {
        const tokens = Array.from(sessionsByRoom.get(roomCode));
        tokens.forEach(token => invalidateSession(token));
        sessionsByRoom.delete(roomCode);
    }
};

const getSessionBySocketId = (socketId) => {
    for (const [token, session] of sessions) {
        if (session.socketId === socketId && session.isActive) {
            return { token, ...session };
        }
    }
    return null;
};

const findSessionForPlayer = (roomCode, playerName) => {
    for (const [token, session] of sessions) {
        if (session.roomCode === roomCode && 
            session.playerData.name === playerName && 
            session.isActive) {
            return { token, ...session };
        }
    }
    return null;
};

// Sessions live as long as their room. Ending the game or removing a player
// invalidates them, so closing a browser does not forfeit a student's place.
const getAllSessionsForRoom = (roomCode) => {
    const roomSessions = [];
    if (sessionsByRoom.has(roomCode)) {
        sessionsByRoom.get(roomCode).forEach(token => {
            const session = sessions.get(token);
            if (session) {
                roomSessions.push({ token, ...session });
            }
        });
    }
    return roomSessions;
};

module.exports = {
    createSession,
    getSession,
    updateSessionSocket,
    invalidateSession,
    markSessionDisconnected,
    cleanupRoomSessions,
    getSessionBySocketId,
    findSessionForPlayer,
    getAllSessionsForRoom
};
