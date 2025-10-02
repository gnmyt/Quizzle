import "./styles.sass";
import {useState, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPaperPlane, faGripVertical, faSort} from "@fortawesome/free-solid-svg-icons";
import {Reorder, AnimatePresence, motion} from "framer-motion";

export const SequenceClient = ({question, onSubmit}) => {
    const [sortableAnswers, setSortableAnswers] = useState([]);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        if (question && question.answers && Array.isArray(question.answers) && question.answers.length > 0) {
            const shuffled = [...question.answers]
                .map((answer, index) => ({
                    ...answer,
                    originalIndex: index,
                    displayId: `client-${index}-${Math.random().toString(36).substring(2, 9)}`
                }))
                .sort(() => Math.random() - 0.5);
            setSortableAnswers(shuffled);
            setHasSubmitted(false);
        } else {
            setSortableAnswers([]);
            setHasSubmitted(false);
        }
    }, [question]);

    const handleSubmit = () => {
        if (hasSubmitted) return;

        const answerOrder = sortableAnswers.map(answer => answer.originalIndex);
        setHasSubmitted(true);
        onSubmit(answerOrder);
    };

    const canSubmit = sortableAnswers.length > 0 && !hasSubmitted;

    if (!question || !question.answers) {
        return (
            <div className="sequence-client">
                <div className="sequence-instructions">
                    <FontAwesomeIcon icon={faSort} className="sequence-icon" />
                    <span>Warten auf Frage...</span>
                </div>
            </div>
        );
    }

    if (typeof question.answers === 'number') {
        return (
            <div className="sequence-client">
                <div className="sequence-instructions">
                    <FontAwesomeIcon icon={faSort} className="sequence-icon" />
                    <span>Sortieraufgabe wird geladen...</span>
                </div>
                <div className="sequence-error">
                    <p>Reihenfolge-Fragen benötigen die Antwortinhalte.</p>
                    <p>Bitte verwenden Sie den Übungsmodus für Reihenfolge-Fragen.</p>
                </div>
            </div>
        );
    }

    if (!Array.isArray(question.answers) || question.answers.length === 0) {
        return (
            <div className="sequence-client">
                <div className="sequence-instructions">
                    <FontAwesomeIcon icon={faSort} className="sequence-icon" />
                    <span>Keine Antworten verfügbar</span>
                </div>
            </div>
        );
    }

    return (
        <div className="sequence-client">
            <div className="sequence-instructions">
                <FontAwesomeIcon icon={faSort} className="sequence-icon" />
                <span>Ziehen Sie die Antworten in die richtige Reihenfolge</span>
            </div>
            
            <Reorder.Group
                as="div"
                className="sequence-list"
                values={sortableAnswers}
                onReorder={setSortableAnswers}
            >
                <AnimatePresence initial={false}>
                    {sortableAnswers.map((answer, index) => (
                        <Reorder.Item
                            key={answer.displayId}
                            value={answer}
                            style={{listStyleType: "none"}}
                        >
                            <motion.div 
                                className="sequence-item"
                                initial={{opacity: 0, y: -20}}
                                animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, y: -20}}
                                whileDrag={{scale: 1.05}}
                            >
                                <div className="drag-handle">
                                    <FontAwesomeIcon icon={faGripVertical} />
                                </div>
                                <div className="sequence-number">{index + 1}</div>
                                <div className="sequence-content">
                                    {answer.type === "image" ? (
                                        <img src={answer.content} alt={`Answer ${index + 1}`} className="sequence-answer-image" />
                                    ) : (
                                        <span className="sequence-answer-text">{answer.content}</span>
                                    )}
                                </div>
                            </motion.div>
                        </Reorder.Item>
                    ))}
                </AnimatePresence>
            </Reorder.Group>

            <div className="submit-container">
                <button 
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`submit-sequence ${canSubmit ? "submit-shown" : ""}`}
                >
                    <FontAwesomeIcon icon={faPaperPlane} />
                </button>
            </div>
        </div>
    );
};