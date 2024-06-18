import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCheckCircle, faMinus, faPaperPlane, faX} from "@fortawesome/free-solid-svg-icons";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {username, roomCode} = useContext(QuizContext);

    const [points, setPoints] = useState(0);
    const [selection, setSelection] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [answers, setAnswers] = useState([]);

    useEffect(() => {
        if (roomCode === null) {
            navigate("/");
            return;
        }

        const onQuestion = (question) => {
            setAnswers([]);
            setSelection([]);
            setCurrentQuestion(question);
        }

        const onPoints = (points) => {
            setPoints(points);
        }

        const onAnswer = (answer) => {
            setAnswers(answer?.answers);
        }

        const gameEnded = () => {
            navigate("/");
        }

        socket.on("QUESTION_RECEIVED", onQuestion);
        socket.on("POINTS_RECEIVED", onPoints);
        socket.on("ANSWER_RECEIVED", onAnswer);
        socket.on("GAME_ENDED", gameEnded);
        socket.on("disconnect", gameEnded);

        return () => {
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("disconnect", gameEnded);
        }
    }, [roomCode]);

    const submitAnswer = (answers) => {
        let selection = Array.from({length: currentQuestion.answers}, (_, index) => answers.includes(index));
        setSelection(selection);
        socket.emit("SUBMIT_ANSWER", {answers}, (success) => {
            if (!success) {
                console.error("Failed to submit answer");
                return;
            }
            setCurrentQuestion(null);
        });
    }

    const getCorrectStatus = (selection, answers) => {
        let allCorrect = true;
        let correct = 0;
        let anySelected = false;

        for (let i = 0; i < selection.length; i++) {
            if (selection[i]) {
                anySelected = true;
                if (answers[i]) correct++;
                if (!answers[i]) correct--;
            }
            if (answers[i] && !selection[i]) allCorrect = false;
        }

        if (allCorrect && anySelected) return 1;
        if (correct > 0) return 0;

        return -1;
    }

    return (
        <div className="ingame-client">
            {currentQuestion !== null && <>
                <div className="ingame-header">
                    <h2>{currentQuestion.title}</h2>
                </div>

                <div className="ingame-content">
                    {currentQuestion.type === "single" && Array.from({length: currentQuestion.answers}, (_, index) => (
                        <div key={index} className="ingame-answer" onClick={() => submitAnswer([index])}>
                            <FontAwesomeIcon icon={faCheckCircle} className={"ingame-icon"}/>
                        </div>
                    ))}

                    {currentQuestion.type === "multiple" && Array.from({length: currentQuestion.answers}, (_, index) => (
                        <div key={index} className="ingame-answer" onClick={() => setSelection(prevSelection => {
                            const newSelection = [...prevSelection];
                            newSelection[index] = !newSelection[index];
                            if (newSelection.filter(value => value).length > 3) return prevSelection;
                            return newSelection;
                        })}>
                            <FontAwesomeIcon icon={faCheckCircle} className={"ingame-icon" + (selection[index] ? " ingame-icon-selected" : "")}/>
                        </div>
                    ))}

                    <div className="submit-container">
                        <button onClick={() => submitAnswer(selection.map((value, index) => value ? index : null).filter(value => value !== null)
                    )} className={"submit-answers" + (currentQuestion.type === "multiple" && selection.some(value => value) ? " submit-shown" : "")}><FontAwesomeIcon icon={faPaperPlane}/></button></div>
                </div>
            </>}

            {currentQuestion === null && answers.length === 0 && <div className="loading-container">
                <div className="lds-hourglass"></div>
            </div>}

            {currentQuestion === null && answers.length > 0 && <div className="ingame-answers">
                <FontAwesomeIcon icon={getCorrectStatus(selection, answers) === 1 ? faCheck : getCorrectStatus(selection, answers) === 0 ? faMinus : faX}
                                 className={getCorrectStatus(selection, answers) === 1 ? " ingame-icon-correct" : getCorrectStatus(selection, answers) === 0 ? " ingame-icon-partial" : " ingame-icon-wrong"}/>
                <h2>
                    {getCorrectStatus(selection, answers) === 1 && "Richtig!"}
                    {getCorrectStatus(selection, answers) === 0 && "Teilweise richtig!"}
                    {getCorrectStatus(selection, answers) === -1 && "Falsch!"}
                </h2>

                {getCorrectStatus(selection, answers) === 0 && <h3>Richtige Antworten: {answers.map((value, index) => value ? index + 1 : null).filter(value => value !== null).join(", ")}</h3>}
            </div>}
            <div className="ingame-footer">
            <h2>{username}</h2>
                <div className="footer-points">
                    <h2>{points}</h2>
                </div>
            </div>
        </div>
    );
}