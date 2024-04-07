const Joi = require('joi');
module.exports.checkRoom = Joi.object({
    code: Joi.number().required().max(9999)
});

module.exports.joinRoom = Joi.object({
    code: Joi.number().required().max(9999),
    name: Joi.string().required().min(3).max(15),
    character: Joi.string().required().valid('X', 'O')
});

module.exports.answerQuestion = Joi.object({
    answers: Joi.array().items(Joi.number().required()).min(0).max(3)
});