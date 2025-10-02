import "./styles.sass";
import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheckCircle, faImage} from "@fortawesome/free-solid-svg-icons";
import {imageCache} from "@/common/utils/ImageCacheUtil.js";

export const Answer = ({color, answer, onChange, index, removeAnswer, questionUuid}) => {
    const [answerContent, setAnswerContent] = useState(answer && answer.type === "text" ? answer.content : "");
    const [isCorrect, setIsCorrect] = useState(answer ? answer.is_correct || false : false);
    const [imageDataUrl, setImageDataUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadImage = async () => {
            if (answer && answer.imageId) {
                setIsLoading(true);
                try {
                    const dataUrl = await imageCache.getImage(answer.imageId);
                    setImageDataUrl(dataUrl);
                } catch (error) {
                    console.error("Error loading answer image from cache:", error);
                    onChange({...answer, imageId: undefined, type: "text", content: ""});
                } finally {
                    setIsLoading(false);
                }
            } else {
                setImageDataUrl(null);
                setIsLoading(false);
            }
        };

        loadImage();
    }, [answer?.imageId]);

    const storeImageFile = async (file) => {
        if (!file || !file.type.startsWith('image/') || !questionUuid) {
            console.error("Invalid file type or missing question UUID");
            return;
        }

        setIsLoading(true);
        try {
            if (answer && answer.imageId) {
                await imageCache.deleteImage(answer.imageId);
            }

            const imageId = await imageCache.storeImage(questionUuid, file, 'answer', index);
            onChange({...answer, imageId: imageId, type: "image", content: "", is_correct: isCorrect || false});
        } catch (error) {
            console.error("Error storing answer image:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const uploadImage = async () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                storeImageFile(file);
            }
        }
        input.click();
    }

    const deleteImage = async () => {
        if (answer && answer.imageId) {
            try {
                await imageCache.deleteImage(answer.imageId);
            } catch (error) {
                console.error("Error deleting answer image from cache:", error);
            }
        }
        setImageDataUrl(null);
        removeAnswer();
    }

    const updateAnswerContent = (content) => {
        setAnswerContent(content);

        if (content === "") {
            removeAnswer();
            return;
        }

        onChange({...answer, content, type: "text", is_correct: isCorrect || false});
    }

    const updateCorrect = () => {
        setIsCorrect(!isCorrect);

        if (imageDataUrl) {
            onChange({...answer, type: "image", is_correct: !isCorrect});
        } else {
            onChange({...answer, content: answerContent, type: "text", is_correct: !isCorrect});
        }
    }

    useEffect(() => {
        if (answer) {
            setIsCorrect(answer.is_correct || false);
            if (answer.type === "text") {
                setAnswerContent(answer.content || "");
                setImageDataUrl(null);
            } else if (answer.type === "image") {
                setAnswerContent("");
            }
        } else {
            setAnswerContent("");
            setImageDataUrl(null);
            setIsCorrect(false);
        }
    }, [answer]);

    const hasImage = imageDataUrl;

    return (
        <div className={`quiz-answer quiz-answer-${color}`} style={{ opacity: isLoading ? 0.7 : 1 }}>
            {hasImage && !isLoading && <img src={imageDataUrl} alt="answer" onClick={deleteImage}/>}
            {!hasImage && !isLoading && <input type="text" placeholder={`Antwort ${index + 1}`} value={answerContent}
                   onChange={(e) => updateAnswerContent(e.target.value)}/>}
            <div className="answer-actions">
                {answerContent === "" && !hasImage && !isLoading && <FontAwesomeIcon icon={faImage} onClick={uploadImage} className="img-icon"/>}
                {(answerContent !== "" || hasImage) && !isLoading && <FontAwesomeIcon icon={faCheckCircle}
                    onClick={updateCorrect} className={isCorrect ? "quiz-answer-correct" : ""}/>}
            </div>
        </div>
    )
}