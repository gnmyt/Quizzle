import {io} from 'socket.io-client';

export const socket = io("", {
    path: '/api/ws',
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5,
    timeout: 20000,
    forceNew: false
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