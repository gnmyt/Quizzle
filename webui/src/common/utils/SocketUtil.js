import {io} from 'socket.io-client';

class SessionManager {
    constructor() {
        this.sessionToken = localStorage.getItem('quizzle_session_token');
        this.roomCode = localStorage.getItem('quizzle_room_code');
        this.playerData = null;
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 10;
        this.isReconnecting = false;
        this.reconnectionCallbacks = new Set();
    }

    setSession(token, roomCode, playerData) {
        this.sessionToken = token;
        this.roomCode = roomCode;
        this.playerData = playerData;
        localStorage.setItem('quizzle_session_token', token);
        localStorage.setItem('quizzle_room_code', roomCode);
        localStorage.setItem('quizzle_player_data', JSON.stringify(playerData));
    }

    getSession() {
        if (!this.playerData && localStorage.getItem('quizzle_player_data')) {
            try {
                this.playerData = JSON.parse(localStorage.getItem('quizzle_player_data'));
            } catch (e) {
                console.warn('Failed to parse stored player data');
            }
        }
        return {
            token: this.sessionToken,
            roomCode: this.roomCode,
            playerData: this.playerData
        };
    }

    clearSession() {
        this.sessionToken = null;
        this.roomCode = null;
        this.playerData = null;
        localStorage.removeItem('quizzle_session_token');
        localStorage.removeItem('quizzle_room_code');
        localStorage.removeItem('quizzle_player_data');
    }

    hasValidSession() {
        return !!(this.sessionToken && this.roomCode && this.playerData);
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
    const session = sessionManager.getSession();

    console.log('Attempting to reconnect with session...', {
        hasToken: !!session.token,
        roomCode: session.roomCode,
        playerName: session.playerData?.name
    });

    socket.emit('RECONNECT_SESSION', {
        token: session.token,
        roomCode: session.roomCode,
        playerData: session.playerData
    }, (response) => {
        sessionManager.isReconnecting = false;

        if (response?.success) {
            console.log('Successfully reconnected!', response);
            sessionManager.reconnectionAttempts = 0;
            sessionManager.notifyReconnectionCallbacks(true);
        } else {
            console.warn('Failed to reconnect:', response?.error);
            sessionManager.reconnectionAttempts++;
            
            if (sessionManager.reconnectionAttempts >= sessionManager.maxReconnectionAttempts) {
                console.error('Max reconnection attempts reached. Clearing session.');
                sessionManager.clearSession();
                sessionManager.notifyReconnectionCallbacks(false, 'Max reconnection attempts reached');
            } else {
                const delay = Math.min(1000 * Math.pow(2, sessionManager.reconnectionAttempts), 30000);
                console.log(`Retrying reconnection in ${delay}ms (attempt ${sessionManager.reconnectionAttempts})`);
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
    console.log('Socket connected');
    
    sessionManager.reconnectionAttempts = 0;
    
    if (sessionManager.hasValidSession() && !sessionManager.isReconnecting) {
        setTimeout(handleReconnection, 100);
    }
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    
    if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        console.log('Deliberate disconnection, not attempting reconnection');
        return;
    }
    
    console.log('Network disconnection detected, will attempt reconnection...');
    sessionManager.notifyReconnectionCallbacks(false, reason);
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    sessionManager.notifyReconnectionCallbacks(false, error);
});

socket.on('SESSION_EXPIRED', () => {
    console.warn('Session expired on server');
    sessionManager.clearSession();
    sessionManager.notifyReconnectionCallbacks(false, 'Session expired');
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
                    if (response.sessionToken) {
                        sessionManager.setSession(response.sessionToken, roomCode, {name, character});
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
    if (sessionManager.hasValidSession()) {
        const session = sessionManager.getSession();
        return {
            roomCode: session.roomCode,
            playerData: session.playerData
        };
    }
    return null;
};