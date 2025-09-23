const Joi = require('joi');
const { CHARACTER_DATA} = require('../utils/characters');

module.exports.checkRoom = Joi.object({
    code: Joi.number().required().max(9999)
});

module.exports.joinRoom = Joi.object({
    code: Joi.number().required().max(9999),
    name: Joi.string().required().min(2).max(20)
        .pattern(/^[a-zA-Z0-9\s\-_]+$/)
        .custom((value, helpers) => {
            const trimmed = value.trim().replace(/\s+/g, ' ');
            if (trimmed.length < 2) {
                return helpers.error('string.min');
            }
            if (trimmed !== value) {
                return trimmed;
            }
            return value;
        })
        .messages({
            'string.pattern.base': 'Name darf nur Buchstaben, Zahlen, Leerzeichen, Bindestriche und Unterstriche enthalten',
            'string.min': 'Name muss mindestens 2 Zeichen lang sein',
            'string.max': 'Name darf maximal 20 Zeichen lang sein'
        }),
    character: Joi.string().required().valid(...Object.keys(CHARACTER_DATA))
});

module.exports.answerQuestion = Joi.object({
    answers: Joi.array().items(Joi.number().required()).min(0).max(3)
});