const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');

const projectRoot = path.join(__dirname, '..', '..');

/**
 * Boots the real server entrypoint (the same one the Docker image runs) so that the
 * `trust proxy` configuration is exercised end to end, including the rate limiters.
 */
const freePort = () => new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
        const {port} = probe.address();
        probe.close(() => resolve(port));
    });
});

const startServer = async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'quizzle-proxy-'));
    fs.cpSync(path.join(projectRoot, 'content'), path.join(workspace, 'content'), {recursive: true});

    const port = await freePort();
    const child = spawn(process.execPath, [path.join(projectRoot, 'server', 'index.js')], {
        cwd: workspace,
        env: {...process.env, PORT: String(port)},
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const capture = chunk => {
        output += chunk.toString();
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Server did not start in time')), 15000);
        const check = () => {
            if (output.includes('Server is running on port')) {
                clearTimeout(timer);
                resolve();
            }
        };
        child.stdout.on('data', check);
        child.stderr.on('data', check);
        child.on('exit', code => reject(new Error(`Server exited early with code ${code}`)));
    });

    // Give the captured streams a moment to flush log lines emitted during startup.
    const flush = () => new Promise(resolve => setTimeout(resolve, 100));

    return {
        port,
        logs: () => output,
        flush,
        stop: () => new Promise(resolve => {
            child.on('exit', resolve);
            child.kill('SIGKILL');
            fs.rmSync(workspace, {recursive: true, force: true});
        }),
    };
};

const postLogin = (port, forwardedFor) => fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        ...(forwardedFor ? {'x-forwarded-for': forwardedFor} : {}),
    },
    body: JSON.stringify({username: 'nobody', password: 'wrong-password'}),
});

test('Anfragen hinter dem Proxy mit X-Forwarded-For werden nicht mehr abgewiesen', async () => {
    const server = await startServer();
    try {
        const response = await postLogin(server.port, '203.0.113.7');
        await server.flush();

        // Without `trust proxy` the rate limiter logs ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
        assert.ok(
            !server.logs().includes('ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'),
            'rate limiter must not reject X-Forwarded-For',
        );
        assert.strictEqual(response.status, 401);
    } finally {
        await server.stop();
    }
});

test('Der Rate-Limiter zählt pro echter Client-IP aus X-Forwarded-For', async () => {
    const server = await startServer();
    try {
        const client = '198.51.100.23';
        const statuses = [];
        for (let i = 0; i < 11; i++) {
            statuses.push((await postLogin(server.port, client)).status);
        }

        // The login limiter allows 10 attempts per window; the 11th must be throttled.
        assert.strictEqual(statuses[10], 429, `expected throttling, got ${statuses.join(',')}`);

        // A different forwarded client is not affected, proving per-IP keying works.
        const other = await postLogin(server.port, '198.51.100.99');
        assert.strictEqual(other.status, 401);
    } finally {
        await server.stop();
    }
});

test('Direkter Zugriff ohne Proxy-Header funktioniert weiterhin', async () => {
    const server = await startServer();
    try {
        const response = await postLogin(server.port);

        assert.strictEqual(response.status, 401);
    } finally {
        await server.stop();
    }
});
