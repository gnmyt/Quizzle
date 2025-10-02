import {io} from 'socket.io-client';

class SessionManager {
    constructor() {
        this.sessionId = localStorage.getItem('quizzle_session_id');
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 5;
        this.isReconnecting = false;
        this.reconnectionCallbacks = new Set();
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('quizzle_session_id', sessionId);
    }

    getSessionId() {
        return this.sessionId || localStorage.getItem('quizzle_session_id');
    }

    clearSession() {
        this.sessionId = null;
        localStorage.removeItem('quizzle_session_id');
    }

    hasValidSession() {
        return !!(this.getSessionId());
    }

    addReconnectionCallback(callback) {
        this.reconnectionCallbacks.add(callback);
    }

    removeReconnectionCallback(callback) {
        this.reconnectionCallbacks.delete(callback);
    }

    notifyReconnectionCallbacks(success, error = null) {
        this.reconnectionCallbacks.forEach(callback => {
            try {
                callback(success, error);
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
    maxReconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false
});

const handleReconnection = () => {
    if (sessionManager.isReconnecting || !sessionManager.hasValidSession()) {
        return;
    }

    sessionManager.isReconnecting = true;
    const sessionId = sessionManager.getSessionId();

    socket.emit('RECONNECT_WITH_SESSION', { sessionId }, (response) => {
        sessionManager.isReconnecting = false;

        if (response?.success) {
            sessionManager.reconnectionAttempts = 0;
            sessionManager.notifyReconnectionCallbacks(true, response);
        } else {
            if (response?.shouldRedirect || response?.sessionInvalid) {
                sessionManager.clearSession();
                sessionManager.notifyReconnectionCallbacks(false, 'Session invalid - redirect required');
                return;
            }
            
            sessionManager.reconnectionAttempts++;
            
            if (sessionManager.reconnectionAttempts >= sessionManager.maxReconnectionAttempts) {
                sessionManager.clearSession();
                sessionManager.notifyReconnectionCallbacks(false, 'Max reconnection attempts reached');
            } else {
                const delay = Math.min(1000 * Math.pow(2, sessionManager.reconnectionAttempts), 10000);
                setTimeout(() => {
                    if (socket.connected) {
                        handleReconnection();
                    }
                }, delay);
            }
        }
    });
};

socket.on('connect', () => {
    sessionManager.reconnectionAttempts = 0;
    if (sessionManager.hasValidSession() && !sessionManager.isReconnecting) {
        setTimeout(handleReconnection, 100);
    }
});

socket.on('disconnect', (reason) => {
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