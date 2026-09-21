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
    type: Joi.string().valid('multiple-choice', 'true-false', 'text', 'sequence', 'slider').required(),
    timer: Joi.number().integer().min(-1).max(3600).optional()
        .messages({
            'number.min': 'Timer muss -1 (unbegrenzt) oder eine positive Zahl sein',
            'number.max': 'Timer darf maximal 3600 Sekunden (1 Stunde) betragen'
        }),
    pointMultiplier: Joi.string().valid('none', 'double').optional()
        .messages({
            'any.only': 'Punktemultiplikator muss "none" oder "double" sein'
        }),
    b64_image: Joi.string().max(10000000),
    answers: Joi.when('type', {
        is: 'slider',
        then: Joi.array().items(Joi.object({
            correctValue: Joi.number().required(),
            min: Joi.number().required(),
            max: Joi.number().required(),
            step: Joi.number().positive().optional().default(1),
            answerMargin: Joi.string().valid('none', 'low', 'medium', 'high', 'maximum').optional().default('medium'),
            type: Joi.string().optional()
        })).length(1),
        otherwise: Joi.when('type', {
        is: 'text',
        then: Joi.array().items(Joi.object({
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
                })
        })).min(1).max(10),
        otherwise: Joi.when('type', {
            is: 'sequence',
            then: Joi.array().items(Joi.object({
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
                order: Joi.number().integer().min(1).optional()
            })).min(2).max(8),
            otherwise: Joi.when('type', {
                is: 'true-false',
                then: Joi.array().items(Joi.object({
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
            })).length(2).custom((answers, helpers) => {
                const correctCount = answers.filter(a => a.is_correct).length;
                if (correctCount !== 1) {
                    return helpers.error('array.correctCount');
                }
                return answers;
            }).messages({
                'array.correctCount': 'Wahr/Falsch-Fragen müssen genau eine richtige Antwort haben'
            }),
            otherwise: Joi.array().items(Joi.object({
                type: Joi.string().valid('text', 'image').required(),
                content: Joi.string().required().min(1).max(10000000)
                    .messages({
                        'string.min': 'Bild-URL darf nicht leer sein',
                        'string.max': 'Bild ist zu groß'
                    }),
                is_correct: Joi.boolean().required()
            })).min(2).max(6)
            })
        })
    })
    })
});

module.exports.settingsValidation = Joi.object({
    description: Joi.string().allow('').max(300).optional(),
    coverImage: Joi.string().max(10000000).allow(null).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').allow(null).optional(),
    shuffleQuestions: Joi.boolean().optional(),
    shuffleAnswers: Joi.boolean().optional(),
    defaultTimer: Joi.number().integer().min(-1).max(3600).optional(),
    scoringMode: Joi.string().valid('time-based', 'flat').optional()
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
    settings: module.exports.settingsValidation.optional(),
    questions: Joi.array().items(module.exports.questionValidation).min(1).max(50).required()
        .messages({
            'array.min': 'Quiz muss mindestens eine Frage enthalten',
            'array.max': 'Quiz darf maximal 50 Fragen enthalten'
        })
});

// Optional validity for practice quizzes: a future ISO date/time, or null for "never expires".
module.exports.practiceExpiryValidation = Joi.alternatives().try(
    Joi.date().iso().greater('now')
        .messages({
            'date.greater': 'Das Ablaufdatum muss in der Zukunft liegen.',
            'date.format': 'Ungültiges Ablaufdatum.'
        }),
    Joi.valid(null)
).optional();

module.exports.practiceUpload = module.exports.quizUpload.keys({
    expiry: module.exports.practiceExpiryValidation
});
