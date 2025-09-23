import "./styles.sass";
import {useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPaperPlane} from "@fortawesome/free-solid-svg-icons";

export const TextInputClient = ({onSubmit, maxLength = 200}) => {
    const [textAnswer, setTextAnswer] = useState("");

    const handleSubmit = () => {
        if (textAnswer.trim() !== "") {
            onSubmit(textAnswer.trim());
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="text-input-client">
            <div className="text-input-container">
                <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Geben Sie Ihre Antwort ein..."
                    maxLength={maxLength}
                    className="text-answer-input"
                />
                <div className="character-count">
                    {textAnswer.length}/{maxLength}
                </div>
            </div>
            <button 
                onClick={handleSubmit}
                disabled={textAnswer.trim() === ""}
                className={`submit-text-answer ${textAnswer.trim() !== "" ? "submit-shown" : ""}`}
            >
                <FontAwesomeIcon icon={faPaperPlane} />
            </button>
        </div>
    );
};