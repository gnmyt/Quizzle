const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const {firstStart} = require("./utils/file");
const {startCleanupTask} = require("./utils/cleanup");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {path: '/api/ws', cors: {origin: '*'}, connectionStateRecovery: {maxDisconnectionDuration: 2 * 60 * 1000}});

const PORT = process.env.PORT || 6412;

firstStart();

startCleanupTask();

app.use(express.json({limit: '50kb'}));

app.use("/api/branding", require("./routes/branding"));
app.use("/api/quizzes", require("./routes/quizzes"));
app.use("/api/practice", require("./routes/practice"));

io.on('connection', (socket) => require("./socket")(io, socket));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist')));

    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
} else {
    app.get("*", (req, res) => res.status(500).sendFile(path.join(process.cwd(), 'server', 'templates', 'env.html')));
}

app.use((err, req, res, next) => {
    if (err) return res.status(400).json({message: err.message});

    next();
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});