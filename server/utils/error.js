module.exports.validateSchema = (res, schema, object) => {
    const { error } = schema.validate(object, { errors: { wrap: { label: "" } } });
    const message = error?.details[0].message || "No message provided";

    if (error && res) {
        res.status(400).json({ message });
    }

    return error;
};

module.exports.validateSchemaSocket = (callback, schema, object) => {
    const { error, value } = schema.validate(object, { errors: { wrap: { label: "" } } });

    if (error && callback) {
        callback({ success: false, error: error.details[0].message });
    } else if (callback) {
        callback({ success: true, data: value });
    }

    return error;
}