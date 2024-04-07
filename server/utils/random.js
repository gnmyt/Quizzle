module.exports.generateQuizId = () => {
    return Math.random().toString(36).substring(7).toUpperCase();
}

module.exports.generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
}