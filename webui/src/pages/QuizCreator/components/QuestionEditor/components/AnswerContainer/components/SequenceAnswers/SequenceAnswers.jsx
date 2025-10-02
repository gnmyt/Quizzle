import "./styles.sass";
import {useState, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus, faTrash, faGripVertical} from "@fortawesome/free-solid-svg-icons";
import {Reorder, AnimatePresence, motion} from "framer-motion";

export const SequenceAnswers = ({answers, onChange}) => {
    const [newAnswer, setNewAnswer] = useState("");

    useEffect(() => {
        if (answers.some(answer => !answer.id)) {
            const updatedAnswers = answers.map((answer, index) => ({
                ...answer,
                id: answer.id || `answer-${Date.now()}-${index}`
            }));
            onChange(updatedAnswers);
        }
    }, [answers, onChange]);

    const addAnswer = () => {
        if (newAnswer.trim() && answers.length < 8) {
            const newAnswers = [...answers, { 
                content: newAnswer.trim(), 
                order: answers.length + 1,
                id: `answer-${Date.now()}-${Math.random()}`
            }];
            onChange(newAnswers);
            setNewAnswer("");
        }
    };

    const removeAnswer = (index) => {
        const newAnswers = answers.filter((_, i) => i !== index);
        const reorderedAnswers = newAnswers.map((answer, i) => ({
            ...answer,
            order: i + 1
        }));
        onChange(reorderedAnswers);
    };

    const updateAnswer = (index, content) => {
        const newAnswers = [...answers];
        newAnswers[index] = { ...newAnswers[index], content: content };
        onChange(newAnswers);
    };

    const handleInputBlur = (index, content) => {
        if (content.trim() === "") {
            removeAnswer(index);
        } else {
            const newAnswers = [...answers];
            newAnswers[index] = { ...newAnswers[index], content: content.trim() };
            onChange(newAnswers);
        }
    };

    const handleReorder = (newOrder) => {
        const reorderedAnswers = newOrder.map((answer, index) => ({
            ...answer,
            order: index + 1
        }));
        onChange(reorderedAnswers);
    };

    return (
        <div className="sequence-answers-container">
            <div className="sequence-answers-header">
                <h3>Antworten</h3>
                <span className="sequence-answers-hint">Sortieren Sie die Antworten in die richtige Reihenfolge.</span>
            </div>
            
            {answers.length > 0 && (
                <Reorder.Group
                    as="div"
                    className="sequence-answers-list"
                    values={answers}
                    onReorder={handleReorder}
                >
                    <AnimatePresence initial={false}>
                        {answers.map((answer, index) => (
                            <Reorder.Item 
                                key={answer.id || `answer-${index}`} 
                                value={answer}
                                style={{listStyleType: "none"}}
                            >
                                <motion.div 
                                    className="sequence-answer-item"
                                    initial={{opacity: 0, y: -20}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -20}}
                                    whileDrag={{scale: 1.05}}
                                >
                                    <div className="drag-handle">
                                        <FontAwesomeIcon icon={faGripVertical} />
                                    </div>
                                    <div className="answer-number">{index + 1}</div>
                                    <input
                                        type="text"
                                        value={answer.content}
                                        onChange={(e) => updateAnswer(index, e.target.value)}
                                        onBlur={(e) => handleInputBlur(index, e.target.value)}
                                        placeholder={`Antwort ${index + 1}`}
                                        className="sequence-answer-input"
                                        maxLength={150}
                                    />
                                    <button
                                        onClick={() => removeAnswer(index)}
                                        className="remove-answer-btn"
                                        type="button"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </motion.div>
                            </Reorder.Item>
                        ))}
                    </AnimatePresence>
                </Reorder.Group>
            )}

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
                    disabled={!newAnswer.trim() || answers.length >= 8}
                >
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>

            {answers.length === 0 && (
                <div className="no-answers-hint">
                    Fügen Sie mindestens zwei Antworten hinzu, die in der richtigen Reihenfolge sortiert werden sollen
                </div>
            )}
        </div>
    );
};