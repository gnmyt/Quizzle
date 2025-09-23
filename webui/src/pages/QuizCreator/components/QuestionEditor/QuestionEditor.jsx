import "./styles.sass";
import Input from "@/common/components/Input";
import Button from "@/common/components/Button";
import {faClone, faTrash, faListUl, faToggleOn, faKeyboard} from "@fortawesome/free-solid-svg-icons";
import ImagePresenter from "@/pages/QuizCreator/components/QuestionEditor/components/ImagePresenter";
import AnswerContainer from "@/pages/QuizCreator/components/QuestionEditor/components/AnswerContainer";
import {motion, AnimatePresence} from "framer-motion";
import {useState, useRef, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export const QuestionEditor = ({question, onChange, deleteQuestion, duplicateQuestion}) => {
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const popoverRef = useRef(null);
    
    const updateTitle = (title) => onChange({...question, title: title});
    const updateType = (type) => {
        let newAnswers = [];

        if (type === 'true-false') {
            newAnswers = [
                { type: 'text', content: 'Wahr', is_correct: false },
                { type: 'text', content: 'Falsch', is_correct: false }
            ];
        } else if (type === 'text') {
            newAnswers = [{ content: '' }];
        } else {
            newAnswers = question.answers || [];
        }
        
        onChange({...question, type: type, answers: newAnswers});
        setShowTypeSelector(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setShowTypeSelector(false);
            }
        };

        if (showTypeSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showTypeSelector]);

    if (!question) return null;

    const questionType = question.type || 'multiple-choice';

    const getTypeIcon = (type) => {
        switch (type) {
            case 'multiple-choice': return faListUl;
            case 'true-false': return faToggleOn;
            case 'text': return faKeyboard;
            default: return faListUl;
        }
    };

    const getTypeName = (type) => {
        switch (type) {
            case 'multiple-choice': return 'Auswahlmöglichkeiten';
            case 'true-false': return 'Wahr/Falsch';
            case 'text': return 'Text Eingabe';
            default: return 'Auswahlmöglichkeiten';
        }
    };

    const getTypeDescription = (type) => {
        switch (type) {
            case 'multiple-choice': return 'Spieler wählen aus vorgegebenen Antwortmöglichkeiten';
            case 'true-false': return 'Spieler wählen zwischen Wahr und Falsch';
            case 'text': return 'Spieler geben ihre Antwort als Text ein';
            default: return 'Spieler wählen aus vorgegebenen Antwortmöglichkeiten';
        }
    };

    const questionTypes = [
        { type: 'multiple-choice', icon: faListUl, name: 'Auswahlmöglichkeiten', description: 'Spieler wählen aus vorgegebenen Antwortmöglichkeiten' },
        { type: 'true-false', icon: faToggleOn, name: 'Wahr/Falsch', description: 'Spieler wählen zwischen Wahr und Falsch' },
        { type: 'text', icon: faKeyboard, name: 'Text Eingabe', description: 'Spieler geben ihre Antwort als Text ein' }
    ];

    return (
        <motion.div className="question-editor" initial={{x: -300, opacity: 0}} animate={{x: 0, opacity: 1}}>
            <div className="question-action-area">
                <Input placeholder="Fragentitel eingeben" value={question.title} onChange={(e) => updateTitle(e.target.value)}
                          textAlign="center"/>
                
                <div className="question-type-selector-container" ref={popoverRef}>
                    <button 
                        className="question-type-button" 
                        onClick={() => setShowTypeSelector(!showTypeSelector)}
                        type="button"
                    >
                        <FontAwesomeIcon icon={getTypeIcon(questionType)} />
                        <span>{getTypeName(questionType)}</span>
                    </button>
                    
                    <AnimatePresence>
                        {showTypeSelector && (
                            <motion.div 
                                className="type-selector-popover"
                                initial={{opacity: 0, y: -10, scale: 0.95}}
                                animate={{opacity: 1, y: 0, scale: 1}}
                                exit={{opacity: 0, y: -10, scale: 0.95}}
                                transition={{duration: 0.2}}
                            >
                                {questionTypes.map((typeOption) => (
                                    <div 
                                        key={typeOption.type}
                                        className={`type-option ${questionType === typeOption.type ? 'active' : ''}`}
                                        onClick={() => updateType(typeOption.type)}
                                    >
                                        <div className="type-option-header">
                                            <FontAwesomeIcon icon={typeOption.icon} />
                                            <span className="type-name">{typeOption.name}</span>
                                        </div>
                                        <p className="type-description">{typeOption.description}</p>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                
                <Button icon={faClone} type="green" onClick={() => duplicateQuestion(question.uuid)} padding="0.8rem 0.8rem"/>
                <Button icon={faTrash} type="red" onClick={() => deleteQuestion(question.uuid)} padding="0.8rem 0.8rem"/>
            </div>

            <ImagePresenter question={question} onChange={onChange}/>

            <AnswerContainer question={question} onChange={onChange} />
        </motion.div>
    )
}