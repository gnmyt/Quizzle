import "./styles.sass";
import Answer from "./components/Answer";

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

    return (
        <div className="answer-container">
            {["orange", "blue", "green", "red"].map((color, index) => (
                <Answer key={index} color={color} answer={question.answers[index]}
                        onChange={(answer) => updateAnswer(answer, index)} index={index}
                        removeAnswer={() => removeAnswer(index)} />
            ))}
        </div>
    )
}