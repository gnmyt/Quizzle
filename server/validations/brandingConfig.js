const Joi = require('joi');

module.exports.brandingConfig = Joi.object({
    imprint: Joi.string().uri().required(),
    privacy: Joi.string().uri().required(),
    color: Joi.string().required().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    name: Joi.string().required()
});