const Joi = require('joi');

module.exports.quizUpload = Joi.object({
    title: Joi.string().required(),
    questions: Joi.array().items(Joi.object({
        title: Joi.string().required(),
        b64_image: Joi.string(),
        answers: Joi.array().items(Joi.object({
            type: Joi.string().valid('text', 'image').required(),
            content: Joi.string().required(),
            is_correct: Joi.boolean().required()
        })).min(2).required()
    })).min(1).required()
});