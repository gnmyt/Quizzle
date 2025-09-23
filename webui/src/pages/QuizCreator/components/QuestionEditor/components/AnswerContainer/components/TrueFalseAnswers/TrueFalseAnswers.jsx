import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheckCircle} from "@fortawesome/free-solid-svg-icons";

export const TrueFalseAnswers = ({answers, onChange}) => {
    const updateAnswer = (index, isCorrect) => {
        const newAnswers = [...answers];

        newAnswers[0] = {...newAnswers[0], is_correct: index === 0 ? isCorrect : false};
        newAnswers[1] = {...newAnswers[1], is_correct: index === 1 ? isCorrect : false};
        
        onChange(newAnswers);
    };

    return (
        <div className="true-false-container">
            <div className={`true-false-answer true-false-true ${answers[0]?.is_correct ? 'selected' : ''}`}
                 onClick={() => updateAnswer(0, true)}>
                <span>Wahr</span>
                <FontAwesomeIcon icon={faCheckCircle} className={`check-icon ${answers[0]?.is_correct ? 'correct' : ''}`}/>
            </div>
            <div className={`true-false-answer true-false-false ${answers[1]?.is_correct ? 'selected' : ''}`}
                 onClick={() => updateAnswer(1, true)}>
                <span>Falsch</span>
                <FontAwesomeIcon icon={faCheckCircle} className={`check-icon ${answers[1]?.is_correct ? 'correct' : ''}`}/>
            </div>
        </div>
    );
};