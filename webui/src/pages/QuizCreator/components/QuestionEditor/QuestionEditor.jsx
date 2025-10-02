import "./styles.sass";
import Input from "@/common/components/Input";
import Button from "@/common/components/Button";
import {faClone, faTrash} from "@fortawesome/free-solid-svg-icons";
import ImagePresenter from "@/pages/QuizCreator/components/QuestionEditor/components/ImagePresenter";
import AnswerContainer from "@/pages/QuizCreator/components/QuestionEditor/components/AnswerContainer";
import {motion, AnimatePresence} from "framer-motion";
import {useState, useRef, useEffect} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {QUESTION_TYPE_CONFIG, getQuestionTypeIcon, getQuestionTypeName, getDefaultAnswersForType, DEFAULT_QUESTION_TYPE} from "@/common/constants/QuestionTypes.js";

export const QuestionEditor = ({question, onChange, deleteQuestion, duplicateQuestion}) => {
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const popoverRef = useRef(null);
    
    const updateTitle = (title) => onChange({...question, title: title});
    const updateType = (type) => {
        const newAnswers = getDefaultAnswersForType(type);
        if (newAnswers.length === 0) {
            onChange({...question, type: type});
        } else {
            onChange({...question, type: type, answers: newAnswers});
        }
        setShowTypeSelector(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) setShowTypeSelector(false);
        };
        if (showTypeSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTypeSelector]);

    if (!question) return null;
    const questionType = question.type || DEFAULT_QUESTION_TYPE;

    const getTypeIcon = (type) => getQuestionTypeIcon(type);
    const getTypeName = (type) => getQuestionTypeName(type);
    const getTypeDescription = (type) => {
        const config = QUESTION_TYPE_CONFIG.find(c => c.type === type);
        return config ? config.description : '';
    };

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
                                {QUESTION_TYPE_CONFIG.map((typeOption) => (
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