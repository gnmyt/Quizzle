import {createContext, useEffect, useMemo, useState} from "react";
import {request} from "@/common/utils/RequestUtil.js";
import pako from "pako";
import {socket, getSessionData} from "@/common/utils/SocketUtil.js";

export const QuizContext = createContext({});

export const QuizProvider = ({children}) => {
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [scoreboard, setScoreboard] = useState([]);
    const [roomCode, setRoomCode] = useState(null);
    const [username, setUsername] = useState("");
    const [soundEnabled, setSoundEnabled] = useState(true);

    useEffect(() => {
        const sessionData = getSessionData();
        if (sessionData && !roomCode && !username) {
            console.log('Restoring session data in QuizContext', sessionData);
            setRoomCode(sessionData.roomCode);
            setUsername(sessionData.playerData.name);
        }
    }, [roomCode, username]);

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
        if (json.__type !== "QUIZZLE2") {
            return false;
        }

        const {title, questions} = json;

        if (!title || title.length > 100) {
            return false;
        }
        
        if (!questions || questions.length === 0) {
            return false;
        }
        
        if (questions.some(q => !q.title || q.title === "")) {
            return false;
        }
        
        if (questions.some(q => q.title.length > 200)) {
            return false;
        }

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            if (!question.type) {
                return false;
            }
            
            const questionType = question.type;
            
            if (questionType === 'text') {
                if (!question.answers || question.answers.length === 0) {
                    return false;
                }
                if (question.answers.length > 10) {
                    return false;
                }
                if (question.answers.some(a => !a.content || a.content.trim() === "")) {
                    return false;
                }
                if (question.answers.some(a => a.content.length > 150)) {
                    return false;
                }
            } else if (questionType === 'true-false') {
                if (!question.answers || question.answers.length !== 2) {
                    return false;
                }
                if (question.answers.some(a => typeof a.is_correct !== 'boolean')) {
                    return false;
                }
                if (!question.answers.some(a => a.is_correct)) {
                    return false;
                }
                if (question.answers.filter(a => a.is_correct).length !== 1) {
                    return false;
                }
            } else if (questionType === 'multiple-choice') {
                if (!question.answers || question.answers.length < 2) {
                    return false;
                }
                if (question.answers.length > 6) {
                    return false;
                }
                
                if (question.answers.some(a => typeof a.is_correct !== 'boolean')) {
                    return false;
                }
                if (question.answers.filter(a => a.is_correct).length === 0) {
                    return false;
                }
                if (question.answers.some(a => !a.content || a.content.trim() === "")) {
                    return false;
                }
                if (question.answers.some(a => a.content.length > 150)) {
                    return false;
                }
            } else {
                return false;
            }
        }
        return true;
    }

    const loadQuizByContent = (content) => {
        try {
            const data = pako.inflate(new Uint8Array(content), {to: "string"});
            const parsedData = JSON.parse(data);

            if (!validateQuiz(parsedData)) {
                return false;
            }

            const questions = randomizeArray(parsedData.questions);

            setQuiz({title: parsedData.title, questions});
            setQuestions(questions);
            return true;
        } catch (error) {
            return false;
        }
    }

    const loadQuizById = async (id) => {
        try {
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
        } catch (error) {
            return false;
        }
    }

    useEffect(() => {
        socket.on("GAME_ENDED", (data) => setScoreboard(data));

        return () => {
            socket.off("GAME_ENDED");
        }
    }, []);

    return (
        <QuizContext.Provider value={{isLoaded, loadQuizById, loadQuizByContent, quizRaw: quiz, pullNextQuestion,
            scoreboard, setScoreboard, roomCode, setRoomCode, username, setUsername}}>
            {children}
        </QuizContext.Provider>
    );
}