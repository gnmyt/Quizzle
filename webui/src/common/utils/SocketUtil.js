import { io } from 'socket.io-client';

export const socket = io("", {path: '/api/ws', autoConnect: false});