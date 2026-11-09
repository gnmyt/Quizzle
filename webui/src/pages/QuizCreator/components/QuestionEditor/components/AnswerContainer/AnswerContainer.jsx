import "./styles.sass";
import Answer from "./components/Answer";
import {TrueFalseAnswers} from "./components/TrueFalseAnswers";
import {TextAnswers} from "./components/TextAnswers";
import SequenceAnswers from "./components/SequenceAnswers";
import SliderAnswers from "./components/SliderAnswers";
import {QUESTION_TYPES, DEFAULT_QUESTION_TYPE} from "@/common/constants/QuestionTypes.js";
import WordCloud from '@/common/components/WordCloud';

export const AnswerContainer = ({onChange, question}) => {

    const updateAnswer = (answer, index) => {
        const newAnswers = [...question.answers];
        newAnswers[index] = answer;
        onChange({...question, answers: newAnswers});
    }

    const removeAnswer = (index) => {
        const newAnswers = [...question.answers];
        newAnswers[index] = undefined;
        while (newAnswers.length > 0 && newAnswers[newAnswers.length - 1] === undefined) {
            newAnswers.pop();
        }
        onChange({...question, answers: newAnswers});
    }

    const updateAnswers = (newAnswers) => {
        onChange({...question, answers: newAnswers});
    }

    const questionType = question.type || DEFAULT_QUESTION_TYPE;

    if (questionType === QUESTION_TYPES.WORD_CLOUD) {
        return (
            <div className="answer-container full-layout">
                <p>Jeder Spieler sendet einen Begriff oder eine kurze Wortgruppe mit bis zu 40 Zeichen.
                    Häufige Begriffe erscheinen größer, ähnliche Schreibweisen stehen nebeneinander. Diese Frage gibt keine Punkte.</p>
                <WordCloud words={[{text: 'Ideen', count: 4}, {text: 'Kreativität', count: 2}, {text: 'Gemeinsam', count: 1}]} totalResponses={7}/>
            </div>
        );
    }

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

    if (questionType === QUESTION_TYPES.SLIDER) {
        return (
            <div className="answer-container full-layout">
                <SliderAnswers answers={question.answers || [{correctValue: 50, min: 0, max: 100, step: 1, answerMargin: 'medium'}]} onChange={updateAnswers}/>
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
