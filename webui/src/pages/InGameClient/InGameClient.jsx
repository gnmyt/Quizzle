import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {roomCode} = useContext(QuizContext);

    const [currentQuestion, setCurrentQuestion] = useState({});

    useEffect(() => {
        if (roomCode === null) {
            navigate("/");
            return;
        }

        const onQuestion = (question) => {
            setCurrentQuestion(question);
        }

        socket.on("QUESTION_RECEIVED", onQuestion);

        return () => {
            socket.off("QUESTION_RECEIVED", onQuestion);
        }
    }, [roomCode]);

    const submitAnswer = (answers) => {
        socket.emit("SUBMIT_ANSWER", {answers}, (success) => {
            if (!success) {
                console.error("Failed to submit answer");
                return;
            }
            setCurrentQuestion(null);
        });
    }

    return (
        <div className="ingame-client">
            <h2>Question</h2>
            <p>{currentQuestion?.title}</p>
            <ul>
                {Array.from({length: currentQuestion?.answers}, (_, i) => (
                    <button key={i} onClick={() => submitAnswer([i])}>Answer {i + 1}</button>
                ))}
            </ul>
        </div>
    );
}