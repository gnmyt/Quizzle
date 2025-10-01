const crypto = require('crypto');
const socket = require('../socket');

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
        isActive: true
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
        return true;
    }
    return false;
};

const invalidateSession = (token) => {
    const session = sessions.get(token);
    if (session) {
        session.isActive = false;
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

const cleanupRoomSessions = (roomCode) => {
    if (sessionsByRoom.has(roomCode)) {
        const tokens = Array.from(sessionsByRoom.get(roomCode));
        tokens.forEach(token => invalidateSession(token));
        sessionsByRoom.delete(roomCode);
    }
};

const cleanupExpiredSessions = () => {
    const now = Date.now();
    const expirationTime = 30 * 60 * 1000;
    
    const expiredSessions = [];
    sessions.forEach((session, token) => {
        if (now - session.lastActivity > expirationTime) {
            expiredSessions.push({token, session});
        }
    });

    expiredSessions.forEach(({token, session}) => {
        const rooms = socket.rooms;
        if (session.roomCode && rooms && rooms[session.roomCode]) {
            const room = rooms[session.roomCode];
            if (room.players[session.socketId]) {
                console.log(`Removing expired player ${session.playerData.name} from room ${session.roomCode}`);
                delete room.players[session.socketId];
            }
        }
        
        invalidateSession(token);
    });
    
    console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
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

setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

module.exports = {
    createSession,
    getSession,
    updateSessionSocket,
    invalidateSession,
    cleanupRoomSessions,
    getSessionBySocketId,
    findSessionForPlayer,
    cleanupExpiredSessions
};