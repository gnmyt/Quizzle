import {createContext, useEffect, useMemo, useState} from "react";
import {request} from "@/common/utils/RequestUtil.js";
import pako from "pako";
import {socket, getSessionData} from "@/common/utils/SocketUtil.js";
import {soundManager} from "@/common/utils/SoundManager.js";
import {QuizValidationUtil} from "@/common/utils/QuizValidationUtil.js";

export const QuizContext = createContext({});

export const QuizProvider = ({children}) => {
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [scoreboard, setScoreboard] = useState([]);
    const [roomCode, setRoomCode] = useState(null);
    const [username, setUsername] = useState("");
    const [soundEnabled, setSoundEnabled] = useState(() => soundManager.getSoundEnabled());

    useEffect(() => {
        const sessionData = getSessionData();
        if (sessionData && !roomCode && !username) {
            console.log('Restoring session data in QuizContext', sessionData);
            setRoomCode(sessionData.roomCode);
            setUsername(sessionData.playerData.name);
        }
    }, [roomCode, username]);

    useEffect(() => {
        soundManager.setSoundEnabled(soundEnabled);
    }, [soundEnabled]);

    const toggleSound = () => {
        const newSoundEnabled = !soundEnabled;
        setSoundEnabled(newSoundEnabled);
        soundManager.setSoundEnabled(newSoundEnabled);
    };

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

    const validateQuiz = (json) => QuizValidationUtil.validateQuizForContext(json);

    const loadQuizByContent = (content) => {
        try {
            const data = pako.inflate(new Uint8Array(content), {to: "string"});
            const parsedData = JSON.parse(data);

            if (!validateQuiz(parsedData)) return false;

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
            if (!result.ok) return false;

            const dataRaw = await result.blob();
            const data = pako.inflate(new Uint8Array(await dataRaw.arrayBuffer()), {to: "string"});
            const parsedData = JSON.parse(data);

            if (!validateQuiz(parsedData)) return false;

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
            scoreboard, setScoreboard, roomCode, setRoomCode, username, setUsername, soundEnabled, setSoundEnabled, toggleSound}}>
            {children}
        </QuizContext.Provider>
    );
}