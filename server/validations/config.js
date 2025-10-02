const Joi = require('joi');

module.exports.config = Joi.object({
    password: Joi.string().optional().allow('')
});