import "./styles.sass";
import {useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus, faTrash} from "@fortawesome/free-solid-svg-icons";

export const TextAnswers = ({answers, onChange}) => {
    const [newAnswer, setNewAnswer] = useState("");

    const addAnswer = () => {
        if (newAnswer.trim() && answers.length < 10) {
            const newAnswers = [...answers, { content: newAnswer.trim() }];
            onChange(newAnswers);
            setNewAnswer("");
        }
    };

    const removeAnswer = (index) => {
        const newAnswers = answers.filter((_, i) => i !== index);
        onChange(newAnswers);
    };

    const updateAnswer = (index, content) => {
        if (content.trim() === "") {
            removeAnswer(index);
            return;
        }
        const newAnswers = [...answers];
        newAnswers[index] = { content: content.trim() };
        onChange(newAnswers);
    };

    return (
        <div className="text-answers-container">
            <div className="text-answers-header">
                <h3>Richtige Antworten</h3>
                <span className="text-answers-hint">Groß-/Kleinschreibung wird ignoriert</span>
            </div>
            
            <div className="text-answers-list">
                {answers.map((answer, index) => (
                    <div key={index} className="text-answer-item">
                        <div className="answer-number">{index + 1}</div>
                        <input
                            type="text"
                            value={answer.content}
                            onChange={(e) => updateAnswer(index, e.target.value)}
                            placeholder={`Antwort ${index + 1}`}
                            className="text-answer-input"
                            maxLength={150}
                        />
                        <button
                            onClick={() => removeAnswer(index)}
                            className="remove-answer-btn"
                            type="button"
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="add-answer-section">
                <div className="answer-number-placeholder">+</div>
                <input
                    type="text"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Neue Antwort hinzufügen..."
                    className="new-answer-input"
                    maxLength={150}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addAnswer();
                        }
                    }}
                />
                <button
                    onClick={addAnswer}
                    className="add-answer-btn"
                    type="button"
                    disabled={!newAnswer.trim() || answers.length >= 10}
                >
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>

            {answers.length === 0 && (
                <div className="no-answers-hint">
                    Fügen Sie mindestens eine akzeptierte Antwort hinzu
                </div>
            )}
        </div>
    );
};