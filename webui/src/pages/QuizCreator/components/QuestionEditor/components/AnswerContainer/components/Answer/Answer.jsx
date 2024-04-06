import "./styles.sass";
import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheckCircle, faImage} from "@fortawesome/free-solid-svg-icons";

export const Answer = ({color, answer, onChange, index, removeAnswer}) => {
    const [answerContent, setAnswerContent] = useState(answer && answer.type === "text" ? answer.content : "");
    const [isCorrect, setIsCorrect] = useState(answer ? answer.is_correct || false : false);
    const [imageContent, setImageContent] = useState(answer && answer.type === "image" ? answer.content : "");

    const uploadImage = async () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                setImageContent(e.target.result);
                onChange({...answer, content: e.target.result, type: "image", is_correct: isCorrect});
            }
            reader.readAsDataURL(file);
        }
        input.click();
    }

    const deleteImage = () => {
        setImageContent("");
        removeAnswer();
    }

    const updateAnswerContent = (content) => {
        setAnswerContent(content);

        if (content === "") {
            removeAnswer();
            return;
        }

        onChange({...answer, content, type: "text", is_correct: isCorrect});
    }

    const updateCorrect = () => {
        setIsCorrect(!isCorrect);

        if (imageContent) {
            onChange({...answer, content: imageContent, type: "image", is_correct: !isCorrect});
        } else {
            onChange({...answer, content: answerContent, type: "text", is_correct: !isCorrect});
        }
    }

    useEffect(() => {
        if (answer) {
            setIsCorrect(answer.is_correct);
            if (answer.type === "text") {
                setAnswerContent(answer.content);
            } else {
                setImageContent(answer.content);
            }
        } else {
            setAnswerContent("");
            setImageContent("");
            setIsCorrect(false);
        }
    }, [answer]);

    return (
        <div className={`quiz-answer quiz-answer-${color}`}>
            {imageContent && <img src={imageContent} alt="answer" onClick={deleteImage}/>}
            {!imageContent && <input type="text" placeholder={`Antwort ${index + 1}`} value={answerContent}
                   onChange={(e) => updateAnswerContent(e.target.value)}/>}
            <div className="answer-actions">
                {answerContent === "" && <FontAwesomeIcon icon={faImage} onClick={uploadImage} className="img-icon"/>}
                {(answerContent !== "" || imageContent !== "") && <FontAwesomeIcon icon={faCheckCircle}
                    onClick={updateCorrect} className={isCorrect ? "quiz-answer-correct" : ""}/>}
            </div>
        </div>
    )
}