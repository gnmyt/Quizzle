const Joi = require('joi');

module.exports.questionValidation = Joi.object({
    title: Joi.string().required().min(1).max(200)
        .custom((value, helpers) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return helpers.error('string.min');
            }
            return trimmed;
        })
        .messages({
            'string.min': 'Fragetitel darf nicht leer sein',
            'string.max': 'Fragetitel darf maximal 200 Zeichen lang sein'
        }),
    b64_image: Joi.string().max(5000000),
    answers: Joi.array().items(Joi.object({
        type: Joi.string().valid('text', 'image').required(),
        content: Joi.string().required().min(1).max(150)
            .custom((value, helpers) => {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                    return helpers.error('string.min');
                }
                return trimmed;
            })
            .messages({
                'string.min': 'Antwort darf nicht leer sein',
                'string.max': 'Antwort darf maximal 150 Zeichen lang sein'
            }),
        is_correct: Joi.boolean().required()
    })).min(2).max(6).required()
});

module.exports.quizUpload = Joi.object({
    title: Joi.string().required().min(1).max(100)
        .custom((value, helpers) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return helpers.error('string.min');
            }
            return trimmed;
        })
        .messages({
            'string.min': 'Quiz-Titel darf nicht leer sein',
            'string.max': 'Quiz-Titel darf maximal 100 Zeichen lang sein'
        }),
    questions: Joi.array().items(module.exports.questionValidation).min(1).max(50).required()
        .messages({
            'array.min': 'Quiz muss mindestens eine Frage enthalten',
            'array.max': 'Quiz darf maximal 50 Fragen enthalten'
        })
});