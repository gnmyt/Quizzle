import pako from 'pako';
import {generateUuid} from './UuidUtil.js';
import {imageCache} from './ImageCacheUtil.js';
import {DEFAULT_QUESTION_TYPE} from '../constants/QuestionTypes.js';

export const createFileInput = (accept, onFileSelected) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file && onFileSelected) onFileSelected(file);
    };
    input.click();
};

export const importQuizzleFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = pako.inflate(e.target.result, {to: "string"});
                const parsedData = JSON.parse(data);

                if (parsedData.__type !== "QUIZZLE2") throw new Error("Ungültiges Dateiformat.");

                const questions = await Promise.all(parsedData.questions.map(async (q) => {
                    const newUuid = generateUuid();
                    const newQuestion = {uuid: newUuid, ...q, type: q.type || DEFAULT_QUESTION_TYPE};

                    if (q.b64_image) {
                        try {
                            const response = await fetch(q.b64_image);
                            const blob = await response.blob();
                            const file = new File([blob], 'imported-image.png', { type: blob.type });
                            const imageId = await imageCache.storeImage(newUuid, file);
                            newQuestion.imageId = imageId;
                            delete newQuestion.b64_image;
                        } catch (error) {
                            console.error("Error converting imported image to IndexedDB:", error);
                        }
                    }

                    if (newQuestion.answers) {
                        newQuestion.answers = await Promise.all(newQuestion.answers.map(async (answer, index) => {
                            if (answer.type === "image" && answer.content) {
                                try {
                                    const response = await fetch(answer.content);
                                    const blob = await response.blob();
                                    const file = new File([blob], 'imported-answer-image.png', { type: blob.type });
                                    const imageId = await imageCache.storeImage(newUuid, file, 'answer', index);
                                    return {...answer, imageId: imageId, content: ""};
                                } catch (error) {
                                    console.error("Error converting imported answer image to IndexedDB:", error);
                                    return {...answer, type: "text", content: ""};
                                }
                            }
                            return answer;
                        }));
                    }
                    return newQuestion;
                }));

                resolve({title: parsedData.title, questions: questions});
            } catch (e) {
                console.error("Import error:", e);
                reject(new Error("Ungültiges Dateiformat."));
            }
        };
        reader.readAsArrayBuffer(file);
    });
};

export const downloadQuizzleFile = (quizData, filename) => {
    const compressedData = pako.deflate(JSON.stringify(quizData), {to: "string"});
    const blob = new Blob([compressedData], {type: "application/octet-stream"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".quizzle";
    a.click();
    URL.revokeObjectURL(url);
};

export const handleImageUpload = (file, onSuccess, onError) => {
    if (!file || !file.type.startsWith('image/')) {
        if (onError) onError(new Error("Nur Bilddateien sind erlaubt."));
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        if (onSuccess) onSuccess(e.target.result);
    };
    reader.onerror = () => {
        if (onError) onError(new Error("Fehler beim Lesen der Datei."));
    };
    reader.readAsDataURL(file);
};

export const handleImagePaste = (event, onImagePasted) => {
    if (event.clipboardData.files.length > 0) {
        const file = event.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
            handleImageUpload(file, onImagePasted);
        }
    }
};