import "./styles.sass";
import Input from "@/common/components/Input/index.js";
import Button from "@/common/components/Button/index.js";
import {faClone, faTrash} from "@fortawesome/free-solid-svg-icons";
import ImagePresenter from "@/pages/QuizCreator/components/QuestionEditor/components/ImagePresenter";
import AnswerContainer from "@/pages/QuizCreator/components/QuestionEditor/components/AnswerContainer";
import {motion} from "framer-motion";

export const QuestionEditor = ({question, onChange, deleteQuestion, duplicateQuestion}) => {
    const updateTitle = (title) => onChange({...question, title: title});

    if (!question) return null;

    return (
        <motion.div className="question-editor" initial={{x: -300, opacity: 0}} animate={{x: 0, opacity: 1}}>
            <div className="question-action-area">
                <Input placeholder="Fragentitel eingeben" value={question.title} onChange={(e) => updateTitle(e.target.value)}
                          textAlign="center"/>
                <Button icon={faClone} type="green" onClick={() => duplicateQuestion(question.uuid)} padding="0.8rem 0.8rem"/>
                <Button icon={faTrash} type="red" onClick={() => deleteQuestion(question.uuid)} padding="0.8rem 0.8rem"/>
            </div>

            <ImagePresenter question={question} onChange={onChange}/>

            <AnswerContainer question={question} onChange={onChange} />
        </motion.div>
    )
}