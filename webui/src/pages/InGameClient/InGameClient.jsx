import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCheckCircle, faMinus, faPaperPlane, faX} from "@fortawesome/free-solid-svg-icons";
import {TrueFalseClient} from "./components/TrueFalseClient";
import {TextInputClient} from "./components/TextInputClient";

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
        if (currentQuestion.type === 'text') {
            setSelection([answers]);
            socket.emit("SUBMIT_ANSWER", {answers}, (success) => {
                if (!success) {
                    console.error("Failed to submit answer");
                    return;
                }
                setCurrentQuestion(null);
            });
        } else {
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
    }

    const getCorrectStatus = (selection, answers) => {
        if (currentQuestion?.type === 'text') {
            const userAnswer = selection[0];
            if (Array.isArray(answers)) {
                return answers.some(correctAnswer => 
                    correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim()
                ) ? 1 : -1;
            }
            return -1;
        }

        let allCorrect = true;
        let correctSelected = 0;
        let incorrectSelected = 0;
        let anySelected = false;
        let missedCorrect = false;

        for (let i = 0; i < selection.length; i++) {
            if (selection[i]) {
                anySelected = true;
                if (answers[i]) {
                    correctSelected++;
                } else {
                    incorrectSelected++;
                }
            }
            if (answers[i] && !selection[i]) {
                allCorrect = false;
                missedCorrect = true;
            }
        }

        if (allCorrect && anySelected && incorrectSelected === 0) return 1;
        
        if (correctSelected > 0) return 0;

        return -1;
    }

    const renderAnswerContent = () => {
        if (!currentQuestion) return null;

        switch (currentQuestion.type) {
            case 'true-false':
                return (
                    <div className="ingame-content true-false-layout">
                        <TrueFalseClient onSubmit={submitAnswer} />
                    </div>
                );
                
            case 'text':
                return (
                    <div className="ingame-content text-layout">
                        <TextInputClient onSubmit={submitAnswer} maxLength={currentQuestion.maxLength} />
                    </div>
                );
                
            case 'single':
                return (
                    <div className="ingame-content grid-layout">
                        {Array.from({length: currentQuestion.answers}, (_, index) => (
                            <div key={index} className="ingame-answer" onClick={() => submitAnswer([index])}>
                                <FontAwesomeIcon icon={faCheckCircle} className={"ingame-icon"}/>
                            </div>
                        ))}
                    </div>
                );
                
            case 'multiple':
                return (
                    <div className="ingame-content grid-layout">
                        {Array.from({length: currentQuestion.answers}, (_, index) => (
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
                            <button onClick={() => submitAnswer(selection.map((value, index) => value ? index : null).filter(value => value !== null))} 
                                    className={"submit-answers" + (selection.some(value => value) ? " submit-shown" : "")}>
                                <FontAwesomeIcon icon={faPaperPlane}/>
                            </button>
                        </div>
                    </div>
                );
                
            default:
                return <div>Unbekannter Fragetyp</div>;
        }
    };

    return (
        <div className="ingame-client">
            {currentQuestion !== null && (
                <>
                    <div className="ingame-header">
                        <h2>{currentQuestion.title}</h2>
                    </div>

                    {renderAnswerContent()}
                </>
            )}

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

                {getCorrectStatus(selection, answers) === 0 && Array.isArray(answers) && !currentQuestion?.type === 'text' && 
                    <h3>Richtige Antworten: {answers.map((value, index) => value ? index + 1 : null).filter(value => value !== null).join(", ")}</h3>}
                
                {currentQuestion?.type === 'text' && getCorrectStatus(selection, answers) === -1 && Array.isArray(answers) &&
                    <h3>Richtige Antworten: {answers.join(", ")}</h3>}
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