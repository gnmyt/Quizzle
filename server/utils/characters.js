const CHARACTER_DATA = {
    wizard: {emoji: '🧙‍♂️'},
    robot: {emoji: '🤖'},
    alien: {emoji: '👽'},
    ninja: {emoji: '🥷'},
    pirate: {emoji: '🏴‍☠️'},
    knight: {emoji: '⚔️'},
    scientist: {emoji: '🔬'},
    astronaut: {emoji: '🚀'}
};

const isValidCharacter = (characterId) => Object.keys(CHARACTER_DATA).includes(characterId);
const getCharacterData = (characterId) => CHARACTER_DATA[characterId] || null;

module.exports = {CHARACTER_DATA, isValidCharacter, getCharacterData};