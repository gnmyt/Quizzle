import {useState, useCallback} from 'react';

export const useInputValidation = (initialValue = '', validationRules = {}) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [touched, setTouched] = useState(false);

    const validateInput = useCallback((inputValue) => {
        const {
            required = false,
            minLength = 0,
            maxLength = Infinity,
            pattern = null,
            customValidator = null,
            allowedChars = null
        } = validationRules;

        if (required && (!inputValue || inputValue.trim().length === 0)) {
            return 'Dieses Feld ist erforderlich';
        }

        if (!inputValue || inputValue.trim().length === 0) {
            return '';
        }

        const trimmedValue = inputValue.trim();
        if (trimmedValue.length < minLength) {
            return `Mindestens ${minLength} Zeichen erforderlich`;
        }
        if (trimmedValue.length > maxLength) {
            return `Maximal ${maxLength} Zeichen erlaubt`;
        }
        if (pattern && !pattern.test(inputValue)) {
            return 'Ungültiges Format';
        }

        if (allowedChars && !allowedChars.test(inputValue)) {
            return 'Enthält ungültige Zeichen';
        }

        if (customValidator) {
            const customError = customValidator(inputValue);
            if (customError) return customError;
        }

        return '';
    }, [validationRules]);

    const handleChange = useCallback((newValue) => {
        setValue(newValue);
        
        if (touched) {
            const errorMessage = validateInput(newValue);
            setError(errorMessage);

            if (!errorMessage && validationRules.maxLength) {
                const progress = newValue.length / validationRules.maxLength;
                if (progress > 0.8 && progress < 1) {
                    setWarning(`${validationRules.maxLength - newValue.length} Zeichen übrig`);
                } else {
                    setWarning('');
                }
            }
        }
    }, [touched, validateInput, validationRules.maxLength]);

    const handleBlur = useCallback(() => {
        setTouched(true);
        const errorMessage = validateInput(value);
        setError(errorMessage);
    }, [value, validateInput]);

    const validate = useCallback(() => {
        setTouched(true);
        const errorMessage = validateInput(value);
        setError(errorMessage);
        return !errorMessage;
    }, [value, validateInput]);

    const reset = useCallback(() => {
        setValue(initialValue);
        setError('');
        setWarning('');
        setTouched(false);
    }, [initialValue]);

    return {
        value,
        error,
        warning,
        touched,
        isValid: !error && touched,
        setValue: handleChange,
        onBlur: handleBlur,
        validate,
        reset
    };
};

export const validationRules = {
    playerName: {
        required: true,
        minLength: 2,
        maxLength: 20,
        allowedChars: /^[a-zA-Z0-9\s\-_]*$/,
        customValidator: (value) => {
            const trimmed = value.trim();
            if (trimmed !== value) {
                return 'Name darf nicht mit Leerzeichen beginnen oder enden';
            }
            if (/\s{2,}/.test(value)) {
                return 'Keine mehrfachen Leerzeichen erlaubt';
            }
            return null;
        }
    },
    quizTitle: {
        required: true,
        minLength: 1,
        maxLength: 100,
        customValidator: (value) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return 'Titel darf nicht leer sein';
            }
            return null;
        }
    },
    questionTitle: {
        required: true,
        minLength: 1,
        maxLength: 200,
        customValidator: (value) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return 'Frage darf nicht leer sein';
            }
            return null;
        }
    },
    answerText: {
        required: true,
        minLength: 1,
        maxLength: 150,
        customValidator: (value) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return 'Antwort darf nicht leer sein';
            }
            return null;
        }
    }
};