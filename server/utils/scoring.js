const SLIDER_MARGIN_FACTORS = {
    none: 0,
    low: 0.05,
    medium: 0.1,
    high: 0.2,
    maximum: 0.4
};

const evaluateSliderAnswer = (userValue, question) => {
    const config = question.answers[0] || question.answers;
    const correctValue = config.correctValue;
    const range = config.max - config.min;
    const marginFactor = SLIDER_MARGIN_FACTORS[config.answerMargin || 'medium'] || 0.1;
    const margin = range * marginFactor;
    const distance = Math.abs(userValue - correctValue);

    if (distance === 0) return { isCorrect: true, score: 1, distance: 0 };

    if (config.answerMargin === 'maximum') {
        // Maximum mode: closer = more points, full range considered
        const score = Math.max(0, 1 - (distance / range));
        return { isCorrect: score >= 0.6, score, distance };
    }

    if (config.answerMargin === 'none') {
        return { isCorrect: false, score: 0, distance };
    }

    if (distance <= margin) {
        // Within margin: score based on proximity, minimum 0.5
        const score = 1 - (distance / margin) * 0.5;
        return { isCorrect: true, score, distance };
    }

    return { isCorrect: false, score: 0, distance };
};

const isSequenceCompletelyCorrect = (userOrder, correctOrder) => {
    if (userOrder.length !== correctOrder.length) return false;
    for (let i = 0; i < userOrder.length; i++) {
        if (userOrder[i] !== correctOrder[i]) return false;
    }
    return true;
};

const calculateSequencePartialScore = (userOrder, correctOrder) => {
    let correctPositions = 0;
    for (let i = 0; i < Math.min(userOrder.length, correctOrder.length); i++) {
        if (userOrder[i] === correctOrder[i]) correctPositions++;
    }
    return correctPositions / correctOrder.length;
};

const getCorrectOrder = (answers, fallbackLength) => {
    if (Array.isArray(answers)) return answers.map((_, i) => i);
    if (typeof answers === 'number') return Array.from({ length: answers }, (_, i) => i);
    return Array.from({ length: fallbackLength }, (_, i) => i);
};

const evaluateSequenceAnswer = (userOrder, question) => {
    const correctOrder = getCorrectOrder(question.answers, userOrder.length);
    const isCorrect = isSequenceCompletelyCorrect(userOrder, correctOrder);

    if (isCorrect) return { isCorrect: true, score: 1, isPartial: false };

    const partialScore = calculateSequencePartialScore(userOrder, correctOrder);
    return {
        isCorrect: false,
        score: partialScore >= 0.99 ? 1 : Math.max(0.1, partialScore),
        isPartial: partialScore > 0
    };
};

const evaluateTextAnswer = (userAnswer, acceptedAnswers) => {
    const normalized = userAnswer.toLowerCase().trim();
    return acceptedAnswers.some(a => a.content.toLowerCase().trim() === normalized);
};

const evaluateChoiceAnswer = (answer, questionAnswers) => {
    const correctIndices = questionAnswers
        .map((a, idx) => a.is_correct ? idx : -1)
        .filter(idx => idx !== -1);

    const selected = Array.isArray(answer) ? answer : [answer];
    let correctSelected = 0;
    let incorrectSelected = 0;

    for (const idx of selected) {
        if (questionAnswers[idx]?.is_correct) correctSelected++;
        else incorrectSelected++;
    }

    let result;
    if (correctSelected === correctIndices.length && incorrectSelected === 0) {
        result = 'correct';
    } else if (correctSelected > 0) {
        result = 'partial';
    } else {
        result = 'incorrect';
    }

    return { result, correctIndices, correctSelected, incorrectSelected };
};

const calculatePoints = (correctAnswers, startTime, pointMultiplier) => {
    if (pointMultiplier === 'none') return 0;

    const basePoints = 100;
    const maxTime = 30000;
    const timeTaken = Math.min(maxTime, Date.now() - startTime);
    const timeFactor = 1 - timeTaken / maxTime;

    let points = correctAnswers > 0
        ? Math.round(basePoints * timeFactor + (correctAnswers * basePoints))
        : 0;

    if (pointMultiplier === 'double') points *= 2;
    return points;
};

const calculateLiveScore = (question, playerAnswer) => {
    if (question.type === 'word-cloud') return 0;

    if (question.type === 'slider') {
        return evaluateSliderAnswer(playerAnswer, question).score;
    }

    if (question.type === 'text') {
        const userAnswer = playerAnswer.toLowerCase().trim();
        const correct = question.answers.map(a => a.content.toLowerCase().trim());
        return correct.includes(userAnswer) ? 1 : 0;
    }

    if (question.type === 'sequence') {
        return evaluateSequenceAnswer(playerAnswer, question).score;
    }

    let correctSelected = 0;
    let incorrectSelected = 0;
    for (const idx of playerAnswer) {
        if (question.answers[idx].is_correct) correctSelected++;
        else incorrectSelected++;
    }
    return correctSelected > 0
        ? Math.max(0.1, correctSelected - (incorrectSelected * 0.5))
        : 0;
};

module.exports = {
    evaluateSequenceAnswer,
    evaluateTextAnswer,
    evaluateChoiceAnswer,
    evaluateSliderAnswer,
    calculatePoints,
    calculateLiveScore
};
