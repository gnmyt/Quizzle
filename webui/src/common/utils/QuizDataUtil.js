import {imageCache} from './ImageCacheUtil.js';
import {DEFAULT_QUESTION_TYPE, QUESTION_TYPES} from '../constants/QuestionTypes.js';

export const prepareQuizData = async (questions, title, includeImageData = false) => {
    const questionsForProcessing = await Promise.all(questions.map(async (q) => {
        const {uuid, ...rest} = q;
        const cleanQuestion = {...rest, title: rest.title.trim(), type: rest.type || DEFAULT_QUESTION_TYPE};

        if (cleanQuestion.imageId && includeImageData) {
            try {
                const imageData = await imageCache.getImage(cleanQuestion.imageId);
                if (imageData) cleanQuestion.b64_image = imageData;
            } catch (error) {
                console.error("Error loading image for processing:", error);
            }
            delete cleanQuestion.imageId;
        } else if (!includeImageData) {
            delete cleanQuestion.imageId;
        }

        if (cleanQuestion.type === QUESTION_TYPES.TEXT) {
            cleanQuestion.answers = rest.answers.map(a => ({content: a.content.trim()}));
        } else if (cleanQuestion.type === QUESTION_TYPES.SEQUENCE) {
            cleanQuestion.answers = rest.answers.map(a => ({
                content: a.content.trim(),
                order: a.order || 1
            }));
        } else {
            cleanQuestion.answers = await Promise.all(rest.answers.map(async (a) => {
                const cleanAnswer = {...a, content: a.content ? a.content.trim() : "", is_correct: a.is_correct || false};

                if (cleanAnswer.imageId && includeImageData) {
                    try {
                        const imageData = await imageCache.getImage(cleanAnswer.imageId);
                        if (imageData) {
                            cleanAnswer.content = imageData;
                            cleanAnswer.type = "image";
                        }
                    } catch (error) {
                        console.error("Error loading answer image for processing:", error);
                    }
                    delete cleanAnswer.imageId;
                } else if (!includeImageData) {
                    delete cleanAnswer.imageId;
                }
                return cleanAnswer;
            }));
        }
        return cleanQuestion;
    }));

    return {title: title.trim(), questions: questionsForProcessing};
};

export const prepareQuizDataForExport = async (questions, title) => {
    const quizData = await prepareQuizData(questions, title, true);
    return {__type: "QUIZZLE2", ...quizData};
};

export const cleanupQuestionImages = async (questions) => {
    try {
        for (const question of questions) {
            if (question.imageId) await imageCache.deleteImage(question.imageId);
            if (question.answers) {
                for (const answer of question.answers) {
                    if (answer.imageId) await imageCache.deleteImage(answer.imageId);
                }
            }
            await imageCache.deleteImagesForQuestion(question.uuid);
        }
    } catch (error) {
        console.error("Error cleaning up images:", error);
    }
};

export const cleanupSingleQuestionImages = async (question) => {
    if (question) await cleanupQuestionImages([question]);
};