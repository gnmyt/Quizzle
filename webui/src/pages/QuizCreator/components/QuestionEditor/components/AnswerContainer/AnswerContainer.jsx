import "./styles.sass";
import Answer from "./components/Answer";
import {TrueFalseAnswers} from "./components/TrueFalseAnswers";
import {TextAnswers} from "./components/TextAnswers";
import SequenceAnswers from "./components/SequenceAnswers";
import {QUESTION_TYPES, DEFAULT_QUESTION_TYPE} from "@/common/constants/QuestionTypes.js";

export const AnswerContainer = ({onChange, question}) => {

    const updateAnswer = (answer, index) => {
        const newAnswers = [...question.answers];
        newAnswers[index] = answer;
        onChange({...question, answers: newAnswers});
    }

    const removeAnswer = (index) => {
        const newAnswers = question.answers.filter((_, i) => i !== index);
        onChange({...question, answers: newAnswers});
    }

    const updateAnswers = (newAnswers) => {
        onChange({...question, answers: newAnswers});
    }

    const questionType = question.type || DEFAULT_QUESTION_TYPE;

    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        return (
            <div className="answer-container full-layout">
                <TrueFalseAnswers answers={question.answers || []} onChange={updateAnswers}/>
            </div>
        );
    }

    if (questionType === QUESTION_TYPES.TEXT) {
        return (
            <div className="answer-container full-layout">
                <TextAnswers answers={question.answers || []} onChange={updateAnswers}/>
            </div>
        );
    }

    if (questionType === QUESTION_TYPES.SEQUENCE) {
        return (
            <div className="answer-container full-layout">
                <SequenceAnswers answers={question.answers || []} onChange={updateAnswers}/>
            </div>
        );
    }

    return (
        <div className="answer-container grid-layout">
            {["orange", "blue", "green", "red"].map((color, index) => (
                <Answer key={index} color={color} answer={question.answers[index]}
                        onChange={(answer) => updateAnswer(answer, index)} index={index}
                        removeAnswer={() => removeAnswer(index)} questionUuid={question.uuid}/>
            ))}
        </div>
    )
}