export const CHARACTERS = [
    { id: 'wizard', emoji: '🧙‍♂️' },
    { id: 'robot', emoji: '🤖' },
    { id: 'alien', emoji: '👽' },
    { id: 'ninja', emoji: '🥷' },
    { id: 'pirate', emoji: '🏴‍☠️' },
    { id: 'knight', emoji: '⚔️' },
    { id: 'scientist', emoji: '🔬' },
    { id: 'astronaut', emoji: '🚀' }
];

export const getCharacterById = (id) => {
    return CHARACTERS.find(char => char.id === id);
};

export const getCharacterEmoji = (id) => {
    const character = getCharacterById(id);
    return character ? character.emoji : '❓';
};