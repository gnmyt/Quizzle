const WORD_CLOUD_MAX_LENGTH = 40;

const normalizeWordCloudAnswer = (answer) => {
    if (typeof answer !== 'string' || answer.length > WORD_CLOUD_MAX_LENGTH) return null;
    const normalized = answer.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    return normalized.length > 0 && normalized.length <= WORD_CLOUD_MAX_LENGTH ? normalized : null;
};

// Damerau-Levenshtein also recognizes adjacent swapped letters, a common typo.
const spellingDistance = (left, right, limit) => {
    const rows = Array.from({length: left.length + 1}, () => new Array(right.length + 1).fill(Infinity));
    for (let i = 0; i <= left.length; i++) rows[i][0] = i;
    for (let j = 0; j <= right.length; j++) rows[0][j] = j;
    for (let i = 1; i <= left.length; i++) {
        let rowMinimum = rows[i][0];
        for (let j = Math.max(1, i - limit); j <= Math.min(right.length, i + limit); j++) {
            rows[i][j] = Math.min(
                rows[i - 1][j] + 1, rows[i][j - 1] + 1,
                rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
            );
            if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
                rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
            }
            rowMinimum = Math.min(rowMinimum, rows[i][j]);
        }
        if (rowMinimum > limit) return limit + 1;
    }
    return rows[left.length][right.length];
};

const groupSimilarWords = (words) => {
    const groups = [];
    for (const word of words) {
        const key = word.text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/gu, 'ss');
        let closest = null;
        let closestDistance = Infinity;
        for (const group of groups) {
            const length = Math.max(key.length, group.key.length);
            const limit = Math.min(key.length, group.key.length) < 4 ? 0 : length >= 10 ? 2 : 1;
            if (Math.abs(key.length - group.key.length) > limit) continue;
            const distance = spellingDistance(key, group.key, limit);
            if (distance <= limit && distance < closestDistance) {
                closest = group;
                closestDistance = distance;
            }
        }
        if (closest) {
            closest.words.push({...word, group: closest.key});
            closest.count += word.count;
        } else {
            groups.push({key, count: word.count, words: [{...word, group: key}]});
        }
    }
    // Compare against the group's first, most frequent spelling, so chains of
    // progressively different words do not pull unrelated responses together.
    return groups.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
        .flatMap(group => group.words);
};

const buildWordCloud = (answers) => {
    const words = new Map();
    let totalResponses = 0;
    for (const answer of answers) {
        const text = normalizeWordCloudAnswer(answer);
        if (text === null) continue;
        const key = text.toLowerCase();
        const entry = words.get(key) || {text, count: 0};
        entry.count++;
        words.set(key, entry);
        totalResponses++;
    }
    return {
        words: groupSimilarWords([...words.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))),
        totalResponses
    };
};

module.exports = {WORD_CLOUD_MAX_LENGTH, normalizeWordCloudAnswer, buildWordCloud};
