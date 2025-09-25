module.exports.generateQuizId = () => {
    return Math.random().toString(36).substring(7).toUpperCase();
}

module.exports.generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

module.exports.generatePracticeCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
}

module.exports.isAlphabeticCode = (code) => {
    return /^[A-Z]{4}$/.test(String(code).toUpperCase());
}