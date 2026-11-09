import assert from 'node:assert/strict';
import {test} from 'node:test';
import cloud from '../../server/utils/wordCloud.js';
import validation from '../../server/validations/quiz.js';
import scoring from '../../server/utils/scoring.js';
import analytics from '../../server/utils/analytics.js';
import room from '../../server/utils/room.js';
import {QuizValidationUtil} from '../src/common/utils/QuizValidationUtil.js';
import {QUESTION_TYPES, WORD_CLOUD_MAX_LENGTH, getDefaultAnswersForType} from '../src/common/constants/QuestionTypes.js';

const question = {title: 'What comes to mind?', type: 'word-cloud', answers: []};

test('word clouds validate and round-trip as questions without predefined answers', () => {
    assert.equal(QUESTION_TYPES.WORD_CLOUD, question.type);
    assert.equal(WORD_CLOUD_MAX_LENGTH, cloud.WORD_CLOUD_MAX_LENGTH);
    assert.deepEqual(getDefaultAnswersForType(question.type), []);
    assert.equal(validation.questionValidation.validate(question).error, undefined);
    assert.ok(validation.questionValidation.validate({...question, answers: [{content: 'preset'}]}).error);
    assert.equal(QuizValidationUtil.validateQuestion(question).isValid, true);
    const quiz = {__type: 'QUIZZLE2', title: 'Brainstorm', questions: [question]};
    assert.equal(QuizValidationUtil.validateQuizForContext(JSON.parse(JSON.stringify(quiz))), true);
    assert.equal(QuizValidationUtil.validateQuestion({...question, answers: [{content: 'preset'}]}).isValid, false);
    assert.deepEqual(room.buildQuestionPayload(question, {}), {title: question.title, type: 'word-cloud', maxLength: 40});
});

test('case, spacing and Unicode presentation variants merge with accurate counts', () => {
    const result = cloud.buildWordCloud(['  Green   energy  ', 'green energy', 'GREEN ENERGY', 'Ｇｒｅｅｎ energy']);
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].text, 'Green energy');
    assert.equal(result.words[0].count, 4);
    assert.equal(result.totalResponses, 4);
});

test('common typos sit together and retain individual spellings and counts', () => {
    const result = cloud.buildWordCloud(['climate', 'climate', 'climate', 'climtae', 'climat', 'climote', 'oceans']);
    const climate = result.words.find(word => word.text === 'climate');
    for (const spelling of ['climtae', 'climat', 'climote']) {
        const entry = result.words.find(word => word.text === spelling);
        assert.equal(entry.group, climate.group);
        assert.equal(entry.count, 1);
    }
    assert.notEqual(result.words.find(word => word.text === 'oceans').group, climate.group);
    assert.equal(climate.count, 3);
    assert.equal(result.totalResponses, 7);
});

test('short distinct words and chains of progressively different words stay separate', () => {
    const result = cloud.buildWordCloud(['cat', 'car', 'cat', 'cold', 'cold', 'cord', 'card']);
    const word = text => result.words.find(entry => entry.text === text);
    assert.notEqual(word('cat').group, word('car').group);
    assert.equal(word('cord').group, word('cold').group);
    assert.notEqual(word('card').group, word('cold').group);
    assert.equal(result.words.reduce((sum, entry) => sum + entry.count, 0), result.totalResponses);
});

test('accent and German spelling variants stay together without losing their labels', () => {
    const result = cloud.buildWordCloud(['Straße', 'Strasse', 'Müller', 'Mueller']);
    const word = text => result.words.find(entry => entry.text === text);
    assert.equal(word('Straße').group, word('Strasse').group);
    assert.equal(word('Müller').group, word('Mueller').group);
    assert.equal(result.words.length, 4);
    assert.equal(result.totalResponses, 4);
});

test('invalid contributions are rejected and special text remains plain text', () => {
    for (const answer of ['', '   ', 0, null, [], {}, 'a'.repeat(41)]) {
        assert.equal(cloud.normalizeWordCloudAnswer(answer), null);
    }
    assert.equal(cloud.normalizeWordCloudAnswer('a'.repeat(40)), 'a'.repeat(40));
    const result = cloud.buildWordCloud(['__proto__', '__proto__', '<b>hello</b>', '', 12]);
    assert.equal(result.totalResponses, 3);
    assert.equal(result.words.find(word => word.text === '__proto__').count, 2);
    assert.ok(result.words.some(word => word.text === '<b>hello</b>'));
});

test('word-cloud answers do not lower graded accuracy or flag students for review', () => {
    assert.equal(scoring.calculateLiveScore(question, 'climate'), 0);
    assert.equal(analytics.classifyAnswer('climate', question), 'ungraded');
    const players = [{id: 'alice', name: 'Alice', character: 'wizard', points: 100}];
    const graded = {title: 'Capital?', type: 'text', answers: [{content: 'Berlin'}]};
    const result = analytics.generateAnalytics({players, questionHistory: [question, graded], playerAnswers: [{alice: 'climate'}, {alice: 'Berlin'}]});
    assert.equal(result.studentAnalytics[0].accuracy, 100);
    assert.equal(result.studentAnalytics[0].totalAnswered, 2);
    assert.equal(result.studentAnalytics[0].incorrectAnswers, 0);
    assert.equal(result.questionAnalytics[0].ungraded, true);
    assert.equal(result.questionAnalytics[0].words[0].text, 'climate');
    assert.equal(result.questionAnalytics[0].needsReview, false);
    const ungraded = analytics.generateAnalytics({players, questionHistory: [question], playerAnswers: [{alice: 'climate'}]});
    assert.equal(ungraded.studentAnalytics[0].needsAttention, false);
    assert.equal(ungraded.studentAnalytics[0].ungraded, true);
    assert.equal(ungraded.classAnalytics.ungraded, true);
    assert.equal(ungraded.classAnalytics.participationRate, 100);
});
