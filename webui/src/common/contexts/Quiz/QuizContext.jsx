import {createContext, useMemo, useState} from "react";
import {request} from "@/common/utils/RequestUtil.js";
import pako from "pako";

export const QuizContext = createContext({});

export const QuizProvider = ({children}) => {
    const [quiz, setQuiz] = useState(null);

    const isLoaded = useMemo(() => quiz !== null, [quiz]);

    const validateQuiz = (json) => {
        if (json.__type !== "QUIZZLE1") return false;

        const {title, questions} = json;
        if (questions.some(q => q.title === "")) return false;
        if (questions.some(q => q.answers.length < 2)) return false;
        if (questions.some(q => q.answers.filter(a => a.is_correct).length === 0)) return false;
        if (title.length > 100) return false;
        if (questions.some(q => q.title.length > 100)) return false;
        if (questions.some(q => q.answers.some(a => a.title?.length > 100))) return false;

        return true;
    }

    const loadQuizByContent = (content) => {
        const data = pako.inflate(new Uint8Array(content), {to: "string"});
        const parsedData = JSON.parse(data);

        if (!validateQuiz(parsedData)) {
            return false;
        }

        setQuiz(content);
        return true;
    }

    const loadQuizById = async (id) => {
        const result = await request(`/quizzes/${id}`);
        if (!result.ok) {
            return false;
        }

        setQuiz(result);
        return true;
    }

    return (
        <QuizContext.Provider value={{isLoaded, loadQuizById, loadQuizByContent}}>
            {children}
        </QuizContext.Provider>
    );
}