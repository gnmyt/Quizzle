import {io} from 'socket.io-client';

class SessionManager {
    constructor() {
        this.sessionId = localStorage.getItem('quizzle_session_id');
        this.reconnectionAttempts = 0;
        this.reconnectionRequest = null;
        this.reconnectionTimer = null;
        this.reconnectionCallbacks = new Set();
    }

    setSessionId(sessionId) {
        this.resetReconnection();
        this.sessionId = sessionId;
        localStorage.setItem('quizzle_session_id', sessionId);
    }

    getSessionId() {
        return this.sessionId || localStorage.getItem('quizzle_session_id');
    }

    clearSession() {
        this.resetReconnection();
        this.sessionId = null;
        localStorage.removeItem('quizzle_session_id');
    }

    hasValidSession() {
        return !!(this.getSessionId());
    }

    resetReconnection() {
        clearTimeout(this.reconnectionTimer);
        this.reconnectionTimer = null;
        this.reconnectionRequest?.resolve(null);
        this.reconnectionRequest = null;
    }

    addReconnectionCallback(callback) {
        this.reconnectionCallbacks.add(callback);
    }

    removeReconnectionCallback(callback) {
        this.reconnectionCallbacks.delete(callback);
    }

    notifyReconnectionCallbacks(success, error = null, gameState = null) {
        this.reconnectionCallbacks.forEach(callback => {
            try {
                callback(success, error, gameState);
            } catch (e) {
                console.error('Error in reconnection callback:', e);
            }
        });
    }
}

const sessionManager = new SessionManager();

export const socket = io("", {
    path: '/api/ws',
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false
});

const handleReconnection = () => {
    if (!socket.connected || !sessionManager.hasValidSession()) {
        return Promise.resolve(null);
    }

    if (sessionManager.reconnectionRequest) {
        return sessionManager.reconnectionRequest.promise;
    }

    clearTimeout(sessionManager.reconnectionTimer);
    const sessionId = sessionManager.getSessionId();
    const request = {};
    request.promise = new Promise(resolve => { request.resolve = resolve; });
    sessionManager.reconnectionRequest = request;

    socket.timeout(10000).emit('RECONNECT_WITH_SESSION', {sessionId}, (error, response) => {
        // Ignore acknowledgements from a connection or session we already left.
        if (sessionManager.reconnectionRequest !== request) return;
        sessionManager.reconnectionRequest = null;

        if (!error && response?.success) {
            sessionManager.reconnectionAttempts = 0;
            sessionManager.notifyReconnectionCallbacks(true, null, response.gameState);
            request.resolve(response.gameState);
        } else {
            if (response?.shouldRedirect || response?.sessionInvalid) {
                sessionManager.clearSession();
                sessionManager.notifyReconnectionCallbacks(false, 'Session invalid - redirect required');
                request.resolve(null);
                return;
            }

            // A network timeout does not invalidate the saved student session.
            sessionManager.reconnectionAttempts++;
            sessionManager.notifyReconnectionCallbacks(false, error || response?.error || 'Reconnection failed');
            const delay = Math.min(1000 * Math.pow(2, sessionManager.reconnectionAttempts), 10000);
            sessionManager.reconnectionTimer = setTimeout(handleReconnection, delay);
            request.resolve(null);
        }
    });

    return request.promise;
};

socket.on('connect', () => {
    sessionManager.reconnectionAttempts = 0;
    handleReconnection();
});

socket.on('disconnect', (reason) => {
    sessionManager.resetReconnection();
    if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        return;
    }
    sessionManager.notifyReconnectionCallbacks(false, reason);
});

socket.on('connect_error', (error) => {
    sessionManager.notifyReconnectionCallbacks(false, error);
});

socket.on('SESSION_EXPIRED', () => {
    sessionManager.clearSession();
    sessionManager.notifyReconnectionCallbacks(false, 'Session expired');
});

socket.on('HOST_DISCONNECTED', () => {
    sessionManager.clearSession();
    sessionManager.notifyReconnectionCallbacks(false, 'Host disconnected');
});

socket.on('KICKED_FROM_ROOM', () => {
    sessionManager.clearSession();
    sessionManager.notifyReconnectionCallbacks(false, 'Kicked from room');
});

socket.on('GAME_ENDED', () => {
    sessionManager.clearSession();
});

export const ensureSocketConnection = (timeout = 10000) => {
    return new Promise((resolve, reject) => {
        if (socket.connected) {
            resolve();
        } else {
            const timeoutId = setTimeout(() => {
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                reject(new Error('Socket connection timeout'));
            }, timeout);

            const onConnect = () => {
                clearTimeout(timeoutId);
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                resolve();
            };

            const onError = (error) => {
                clearTimeout(timeoutId);
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                reject(error);
            };

            socket.once('connect', onConnect);
            socket.once('connect_error', onError);

            if (!socket.connected) {
                socket.connect();
            }
        }
    });
};

export const joinRoomWithSession = (roomCode, name, character) => {
    return new Promise((resolve, reject) => {
        ensureSocketConnection().then(() => {
            socket.emit("JOIN_ROOM", {code: parseInt(roomCode), name, character}, (response) => {
                if (response?.success) {
                    if (response.sessionId) {
                        sessionManager.setSessionId(response.sessionId);
                    }
                    resolve(response);
                } else {
                    reject(new Error(response?.error || "Fehler beim Beitreten"));
                }
            });
        }).catch(reject);
    });
};

export const getSessionManager = () => sessionManager;

export const restoreSession = () => {
    if (!sessionManager.hasValidSession()) return Promise.resolve(null);
    return ensureSocketConnection().then(handleReconnection).catch(error => {
        sessionManager.notifyReconnectionCallbacks(false, error);
        return null;
    });
};

export const addReconnectionCallback = (callback) => {
    sessionManager.addReconnectionCallback(callback);
};

export const removeReconnectionCallback = (callback) => {
    sessionManager.removeReconnectionCallback(callback);
};

export const clearCurrentSession = () => {
    sessionManager.clearSession();
};

export const getSessionData = () => {
    const sessionId = sessionManager.getSessionId();
    return sessionId ? { sessionId } : null;
};

export const getSessionState = () => {
    return new Promise((resolve) => {
        const sessionId = sessionManager.getSessionId();
        if (!sessionId) {
            resolve(null);
            return;
        }

        socket.emit('GET_SESSION_STATE', { sessionId }, (response) => {
            if (response?.success) {
                resolve(response.sessionState);
            } else {
                if (response?.sessionInvalid) {
                    sessionManager.clearSession();
                }
                resolve(null);
            }
        });
    });
};
