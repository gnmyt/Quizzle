import {QUESTION_TYPES, ANSWER_LIMITS, MINIMUM_ANSWERS} from '../constants/QuestionTypes.js';

export class QuizValidationUtil {
    static LIMITS = {MAX_QUESTIONS: 50, MIN_QUESTIONS: 1, MAX_QUESTION_LENGTH: 200, MAX_ANSWER_LENGTH: 150};

    static validateQuiz(questions, title) {
        if (!title || title.trim() === "") return { isValid: false, error: "Quiz-Titel darf nicht leer sein." };
        if (questions.length === 0) return { isValid: false, error: "Es muss mindestens eine Frage vorhanden sein." };
        if (questions.length > this.LIMITS.MAX_QUESTIONS) return { isValid: false, error: `Quiz darf maximal ${this.LIMITS.MAX_QUESTIONS} Fragen enthalten.` };

        for (const question of questions) {
            const questionValidation = this.validateQuestion(question);
            if (!questionValidation.isValid) return questionValidation;
        }
        return { isValid: true };
    }

    static validateQuestion(question) {
        if (!question.title || question.title.trim() === "") return { isValid: false, error: "Fragen dürfen nicht leer sein." };
        if (question.title.trim().length > this.LIMITS.MAX_QUESTION_LENGTH) return { isValid: false, error: `Fragen dürfen maximal ${this.LIMITS.MAX_QUESTION_LENGTH} Zeichen lang sein.` };
        const questionType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
        return this.validateAnswers(question.answers || [], questionType);
    }

    static validateAnswers(answers, questionType) {
        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
            return answers.length === 0 ? {isValid: true} : {isValid: false, error: 'Wortwolken benötigen keine vorgegebenen Antworten.'};
        }
        const minAnswers = MINIMUM_ANSWERS[questionType] ?? 1;
        const maxAnswers = ANSWER_LIMITS[questionType] ?? 6;

        if (answers.length < minAnswers) return { isValid: false, error: this.getMinAnswersErrorMessage(questionType, minAnswers) };
        if (answers.length > maxAnswers) return { isValid: false, error: this.getMaxAnswersErrorMessage(questionType, maxAnswers) };

        switch (questionType) {
            case QUESTION_TYPES.TEXT: return this.validateTextAnswers(answers);
            case QUESTION_TYPES.TRUE_FALSE: return this.validateTrueFalseAnswers(answers);
            case QUESTION_TYPES.SEQUENCE: return this.validateSequenceAnswers(answers);
            case QUESTION_TYPES.SLIDER: return this.validateSliderAnswers(answers);
            case QUESTION_TYPES.MULTIPLE_CHOICE:
            default: return this.validateMultipleChoiceAnswers(answers);
        }
    }

    static validateTextAnswers(answers) {
        if (answers.some(a => !a.content || a.content.trim() === "")) return { isValid: false, error: "Text-Antworten dürfen nicht leer sein." };
        return { isValid: true };
    }

    static validateTrueFalseAnswers(answers) {
        if (answers.length !== 2) return { isValid: false, error: "Wahr/Falsch-Fragen müssen genau zwei Antworten haben." };
        if (!answers.some(a => a.is_correct)) return { isValid: false, error: "Wahr/Falsch-Fragen müssen mindestens eine richtige Antwort haben." };
        return { isValid: true };
    }

    static validateMultipleChoiceAnswers(answers) {
        if (answers.filter(a => a.is_correct).length === 0) return { isValid: false, error: "Jede Multiple-Choice-Frage muss mindestens eine richtige Antwort haben." };
        if (answers.some(a => (!a.content || a.content.trim() === "") && a.imageId === undefined)) return { isValid: false, error: "Multiple-Choice-Antworten dürfen nicht leer sein." };
        if (answers.some(a => a.content?.trim().length > this.LIMITS.MAX_ANSWER_LENGTH && a.type === QUESTION_TYPES.TEXT)) return { isValid: false, error: `Multiple-Choice-Antworten dürfen maximal ${this.LIMITS.MAX_ANSWER_LENGTH} Zeichen lang sein.` };
        return { isValid: true };
    }

    static validateSequenceAnswers(answers) {
        if (answers.some(a => !a.content || a.content.trim() === "")) return { isValid: false, error: "Reihenfolge-Antworten dürfen nicht leer sein." };
        if (answers.some(a => a.content?.trim().length > this.LIMITS.MAX_ANSWER_LENGTH)) return { isValid: false, error: `Reihenfolge-Antworten dürfen maximal ${this.LIMITS.MAX_ANSWER_LENGTH} Zeichen lang sein.` };
        return { isValid: true };
    }

    static validateSliderAnswers(answers) {
        if (!answers || answers.length !== 1) return { isValid: false, error: "Schieberegler-Fragen müssen genau eine Antwort-Konfiguration haben." };
        const config = answers[0];
        if (config.correctValue === undefined || config.correctValue === null) return { isValid: false, error: "Schieberegler-Fragen müssen einen korrekten Wert haben." };
        if (config.min === undefined || config.max === undefined) return { isValid: false, error: "Schieberegler-Fragen müssen einen Min- und Max-Wert haben." };
        if (config.min >= config.max) return { isValid: false, error: "Der Minimalwert muss kleiner als der Maximalwert sein." };
        if (config.correctValue < config.min || config.correctValue > config.max) return { isValid: false, error: "Der korrekte Wert muss zwischen Min und Max liegen." };
        if (config.step !== undefined && config.step <= 0) return { isValid: false, error: "Der Schrittwert muss größer als 0 sein." };
        return { isValid: true };
    }

    static getMinAnswersErrorMessage(questionType, minAnswers) {
        switch (questionType) {
            case QUESTION_TYPES.TEXT: return "Text-Fragen müssen mindestens eine akzeptierte Antwort haben.";
            case QUESTION_TYPES.TRUE_FALSE: return "Wahr/Falsch-Fragen müssen genau zwei Antworten haben.";
            case QUESTION_TYPES.SEQUENCE: return "Reihenfolge-Fragen müssen mindestens zwei Antworten haben.";
            case QUESTION_TYPES.SLIDER: return "Schieberegler-Fragen müssen eine Konfiguration haben.";
            case QUESTION_TYPES.MULTIPLE_CHOICE:
            default: return "Multiple-Choice-Fragen müssen mindestens zwei Antworten haben.";
        }
    }

    static getMaxAnswersErrorMessage(questionType, maxAnswers) {
        switch (questionType) {
            case QUESTION_TYPES.TEXT: return `Text-Fragen dürfen maximal ${maxAnswers} akzeptierte Antworten haben.`;
            case QUESTION_TYPES.TRUE_FALSE: return "Wahr/Falsch-Fragen müssen genau zwei Antworten haben.";
            case QUESTION_TYPES.SEQUENCE: return `Reihenfolge-Fragen dürfen maximal ${maxAnswers} Antworten haben.`;
            case QUESTION_TYPES.SLIDER: return "Schieberegler-Fragen dürfen nur eine Konfiguration haben.";
            case QUESTION_TYPES.MULTIPLE_CHOICE:
            default: return `Multiple-Choice-Fragen dürfen maximal ${maxAnswers} Antworten haben.`;
        }
    }

    static validateQuizForContext(json) {
        if (json.__type !== "QUIZZLE2") return false;
        const {title, questions} = json;
        if (!title || title.length > 100) return false;
        if (!questions || questions.length === 0) return false;
        if (questions.some(q => !q.title || q.title === "" || q.title.length > 200)) return false;

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            if (!question.type) return false;
            const questionType = question.type;
            
            if (questionType === QUESTION_TYPES.WORD_CLOUD) {
                if (!Array.isArray(question.answers) || question.answers.length !== 0) return false;
            } else if (questionType === QUESTION_TYPES.TEXT) {
                if (!question.answers || question.answers.length === 0 || question.answers.length > 10) return false;
                if (question.answers.some(a => !a.content || a.content.trim() === "")) return false;
            } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
                if (!question.answers || question.answers.length !== 2) return false;
                if (question.answers.some(a => typeof a.is_correct !== 'boolean')) return false;
                if (!question.answers.some(a => a.is_correct) || question.answers.filter(a => a.is_correct).length !== 1) return false;
            } else if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
                if (!question.answers || question.answers.length < 2 || question.answers.length > 6) return false;
                if (question.answers.some(a => typeof a.is_correct !== 'boolean')) return false;
                if (question.answers.filter(a => a.is_correct).length === 0) return false;
                if (question.answers.some(a => !a.content || a.content.trim() === "")) return false;
            } else if (questionType === QUESTION_TYPES.SEQUENCE) {
                if (!question.answers || question.answers.length < 2 || question.answers.length > 8) return false;
                if (question.answers.some(a => !a.content || a.content.trim() === "")) return false;
            } else if (questionType === QUESTION_TYPES.SLIDER) {
                if (!question.answers || question.answers.length !== 1) return false;
                const cfg = question.answers[0];
                if (cfg.correctValue == null || cfg.min == null || cfg.max == null) return false;
                if (cfg.min >= cfg.max || cfg.correctValue < cfg.min || cfg.correctValue > cfg.max) return false;
            } else {
                return false;
            }
        }
        return true;
    }
}
