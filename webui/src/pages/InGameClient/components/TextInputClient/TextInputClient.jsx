import "./styles.sass";
import {useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPaperPlane} from "@fortawesome/free-solid-svg-icons";

export const TextInputClient = ({onSubmit, maxLength = 200, placeholder = 'Geben Sie Ihre Antwort ein...'}) => {
    const [textAnswer, setTextAnswer] = useState("");

    const handleSubmit = () => {
        if (textAnswer.trim() !== "") {
            onSubmit(textAnswer.trim());
        }
    };

    const handleKeyDown = (e) => {
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
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className="text-answer-input"
                    aria-label="Antwort eingeben"
                />
                <div className="character-count" aria-live="polite">
                    {textAnswer.length}/{maxLength}
                </div>
            </div>
            <button 
                type="button"
                onClick={handleSubmit}
                disabled={textAnswer.trim() === ""}
                className={`submit-text-answer ${textAnswer.trim() !== "" ? "submit-shown" : ""}`}
                aria-label="Antwort absenden"
            >
                <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
            </button>
        </div>
    );
};
