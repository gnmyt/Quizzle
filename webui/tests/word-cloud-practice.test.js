import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {after, test} from 'node:test';
import express from 'express';
import quizUtils from '../../server/utils/quiz.js';

const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'quizzle-word-cloud-tests-'));
const previousDirectory = process.cwd();
let practice;
try {
    process.chdir(fixtureRoot);
    ({default: practice} = await import('../../server/routes/practice.js'));
} finally {
    process.chdir(previousDirectory);
}
after(async () => {
    assert.equal(path.dirname(fixtureRoot), path.resolve(tmpdir()));
    assert.ok(path.basename(fixtureRoot).startsWith('quizzle-word-cloud-tests-'));
    await rm(fixtureRoot, {recursive: true, force: true});
});

const createPractice = async (t, code, questions) => {
    const quizPath = path.join(fixtureRoot, 'data', 'practice-quizzes', code);
    await mkdir(quizPath, {recursive: true});
    await writeFile(path.join(quizPath, 'quiz.quizzle'), quizUtils.compressQuiz({__type: 'QUIZZLE2', title: 'Brainstorm', questions}));
    await writeFile(path.join(quizPath, 'meta.json'), JSON.stringify({expiry: new Date(Date.now() + 86400000).toISOString()}));
    const app = express();
    app.use(express.json());
    app.use('/practice', practice);
    const server = createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/practice/${code}`;
    const submit = (questionIndex, answer) => fetch(`${url}/submit-answer`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({attemptId: 'test-attempt', questionIndex, answer, name: 'Alice', character: 'wizard'})
    });
    return {url, submit, resultPath: path.join(quizPath, 'results', 'test-attempt.json')};
};

const cloudQuestion = {title: 'Your ideas?', type: 'word-cloud', answers: []};

test('practice records word-cloud responses without reducing the score for graded questions', async t => {
    const game = await createPractice(t, 'ABCD', [cloudQuestion, {title: 'Capital?', type: 'text', answers: [{content: 'Berlin'}]}]);
    const quiz = await (await fetch(game.url)).json();
    assert.equal(quiz.questions[0].type, 'word-cloud');
    assert.equal(quiz.questions[0].maxLength, 40);
    assert.deepEqual(quiz.questions[0].answers, []);
    assert.equal((await game.submit(0, '')).status, 400);
    assert.equal((await game.submit(0, ['climate'])).status, 400);
    const response = await (await game.submit(0, '  Green  energy  ')).json();
    assert.equal(response.result, 'ungraded');
    assert.equal(response.wordCloud.words[0].text, 'Green energy');
    assert.equal((await game.submit(0, 'duplicate')).status, 400);
    const final = await (await game.submit(1, 'Berlin')).json();
    assert.equal(final.isLastQuestion, true);
    assert.equal(final.finalResults.score, 1);
    assert.equal(final.finalResults.total, 1);
    const stored = JSON.parse(await readFile(game.resultPath, 'utf8'));
    assert.equal(stored.answers[0].result, 'ungraded');
    assert.equal(stored.answers[0].userAnswer, 'Green energy');
    assert.equal(stored.answers[0].score, 0);
});

test('a practice questionnaire consisting only of word clouds finishes without a graded score', async t => {
    const game = await createPractice(t, 'WXYZ', [cloudQuestion]);
    const response = await (await game.submit(0, 'climate')).json();
    assert.equal(response.isLastQuestion, true);
    assert.equal(response.result, 'ungraded');
    assert.equal(response.finalResults.total, 0);
    assert.equal(response.finalResults.score, 0);
});
