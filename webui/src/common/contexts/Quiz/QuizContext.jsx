import {createContext, useMemo, useState} from "react";
import {request} from "@/common/utils/RequestUtil.js";
import pako from "pako";

export const QuizContext = createContext({});

export const QuizProvider = ({children}) => {
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);

    const pullNextQuestion = async () => {
        return new Promise((resolve, reject) => {
            setQuestions(prevQuestions => {
                if (prevQuestions.length > 0) {
                    const updatedQuestions = [...prevQuestions];
                    const currentQuestion = updatedQuestions.shift();
                    resolve(currentQuestion);

                    return updatedQuestions;
                } else {
                    reject();
                    return [];
                }
            });
        });
    }

    const randomizeArray = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }

        return newArray;
    }

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

        if (!validateQuiz(parsedData)) return false;

        const questions = randomizeArray(parsedData.questions);

        setQuiz({title: parsedData.title, questions});
        setQuestions(questions);
        return true;
    }

    const loadQuizById = async (id) => {
        const result = await request(`/quizzes/${id}`);
        if (!result.ok) {
            return false;
        }

        const dataRaw = await result.blob();
        const data = pako.inflate(new Uint8Array(await dataRaw.arrayBuffer()), {to: "string"});

        const parsedData = JSON.parse(data);

        if (!validateQuiz(parsedData)) {
            return false;
        }

        const questions = randomizeArray(parsedData.questions);

        setQuiz({title: parsedData.title, questions});
        setQuestions(questions);

        return true;
    }

    return (
        <QuizContext.Provider value={{isLoaded, loadQuizById, loadQuizByContent, quizRaw: quiz, pullNextQuestion}}>
            {children}
        </QuizContext.Provider>
    );
}