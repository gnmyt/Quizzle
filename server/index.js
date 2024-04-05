const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const {firstStart} = require("./utils/file");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {cors: {origin: '*',}, connectionStateRecovery: {maxDisconnectionDuration: 2 * 60 * 1000}});

const PORT = process.env.PORT || 6412;

firstStart();

app.use(express.json({limit: '50kb'}));

app.use("/api/branding", require("./routes/branding"));
app.use("/api/quizzes", require("./routes/quizzes"));

io.of('/api/ws').on('connection', (socket) => {
    console.log('A client connected via Socket.IO');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist', 'index.html')));
} else {
    app.get("*", (req, res) => res.status(500).sendFile(path.join(__dirname, 'templates', 'env.html')));
}

app.use((err, req, res, next) => {
    if (err) return res.status(400).json({message: err.message});

    next();
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});