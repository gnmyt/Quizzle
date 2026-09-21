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

// Exactly one reverse proxy (Zoraxy) sits in front of the app, so trust a single hop.
// A numeric value is used instead of `true` to avoid trusting arbitrary client-supplied
// X-Forwarded-For chains. Direct LAN access on PORT is unaffected because Express then
// falls back to the socket address.
app.set('trust proxy', 1);

firstStart();

startCleanupTask();

app.use(express.json({limit: '100mb'}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin", require("./routes/adminManagement"));
app.use("/api/branding", require("./routes/branding"));
app.use("/api/quizzes", require("./routes/quizzes"));
app.use("/api/practice", require("./routes/practice"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/media", require("./routes/media"));

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