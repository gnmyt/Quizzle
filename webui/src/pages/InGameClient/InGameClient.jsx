import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {socket, addReconnectionCallback, removeReconnectionCallback, clearCurrentSession, getSessionManager} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCheckCircle, faMinus, faPaperPlane, faX, faWifi, faExclamationTriangle} from "@fortawesome/free-solid-svg-icons";
import {TrueFalseClient} from "./components/TrueFalseClient";
import {TextInputClient} from "./components/TextInputClient";
import {jsonRequest, postRequest} from "@/common/utils/RequestUtil.js";
import {generateUuid} from "@/common/utils/UuidUtil.js";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import toast from "react-hot-toast";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {username, roomCode, practiceUserData} = useContext(QuizContext);
    const {practiceCode} = useParams();

    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [practiceQuiz, setPracticeQuiz] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showingPracticeResult, setShowingPracticeResult] = useState(false);
    const [practiceQuestionResult, setPracticeQuestionResult] = useState(null);
    const [attemptId] = useState(() => generateUuid());

    const [points, setPoints] = useState(0);
    const [selection, setSelection] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [lastQuestionType, setLastQuestionType] = useState(null);
    const [userSubmittedAnswer, setUserSubmittedAnswer] = useState(null);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [isReconnecting, setIsReconnecting] = useState(false);

    useEffect(() => {
        if (practiceCode) {
            setIsPracticeMode(true);

            if (!practiceUserData || !practiceUserData.name) {
                toast.error('Bitte wähle zuerst einen Namen und Charakter.');
                navigate(`/?code=${practiceCode}`);
                return;
            }
            
            loadPracticeQuiz();
            return;
        }

        const sessionManager = getSessionManager();
        const session = sessionManager.getSession();
        
        if (!roomCode && session.roomCode && session.playerData) {
            console.log('Restoring session after page refresh...');
        } else if (!roomCode && !session.roomCode) {
            navigate("/");
            return;
        }

        const onQuestion = (question) => {
            setAnswers([]);
            setSelection([]);
            setUserSubmittedAnswer(null);
            setCurrentQuestion(question);
            setLastQuestionType(question?.type || null);
        }

        const onPoints = (points) => {
            setPoints(points);
        }

        const onAnswer = (answer) => {
            setAnswers(answer?.answers);
            setCurrentQuestion(null);
        }

        const gameEnded = () => {
            clearCurrentSession();
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("disconnect", handleDisconnect);
            
            navigate("/");
        }

        const handleConnect = () => {
            setIsConnected(true);
            setIsReconnecting(false);
        };

        const handleDisconnect = (reason) => {
            setIsConnected(false);
            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
                navigate("/");
            }
        };

        const handleReconnection = (success, error) => {
            if (success) {
                setIsReconnecting(false);
                toast.success("Erfolgreich wieder verbunden!", {
                    duration: 3000
                });
            } else {
                setIsReconnecting(true);
                if (error === 'Session expired' || error === 'Max reconnection attempts reached') {
                    toast.error("Verbindung verloren. Zurück zur Startseite...", {
                        duration: 3000
                    });
                    setTimeout(() => navigate("/"), 3000);
                } else {
                    toast.error("Verbindung unterbrochen. Versuche wieder zu verbinden...", {
                        duration: 2000
                    });
                }
            }
        };

        socket.on('GAME_STATE_RESTORED', (gameState) => {
            if (gameState.playerPoints !== undefined) {
                setPoints(gameState.playerPoints);
            }
        });

        const handleSessionRestored = () => {
            const sessionManager = getSessionManager();
            const session = sessionManager.getSession();
            
            if (session.roomCode && session.playerData && !roomCode) {
                setRoomCode(session.roomCode);
                setUsername(session.playerData.name);
                console.log('Session restored from storage');
            }
        };

        handleSessionRestored();

        socket.on("QUESTION_RECEIVED", onQuestion);
        socket.on("POINTS_RECEIVED", onPoints);
        socket.on("ANSWER_RECEIVED", onAnswer);
        socket.on("GAME_ENDED", gameEnded);
        socket.on("disconnect", handleDisconnect);
        socket.on('connect', handleConnect);
        addReconnectionCallback(handleReconnection);

        return () => {
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("disconnect", handleDisconnect);
            socket.off('connect', handleConnect);
            socket.off('GAME_STATE_RESTORED');
            removeReconnectionCallback(handleReconnection);
        }
    }, [roomCode, practiceCode]);

    const loadPracticeQuiz = async () => {
        try {
            const response = await jsonRequest(`/practice/${practiceCode}`);
            if (response && response.questions) {
                setPracticeQuiz(response);
            } else {
                throw new Error('Invalid quiz data received');
            }
        } catch (error) {
            console.error('Error loading practice quiz:', error);
            if (error.message && error.message.includes('410')) {
                toast.error('Dieses Übungsquiz ist abgelaufen.');
            } else if (error.message && error.message.includes('404')) {
                toast.error('Übungsquiz nicht gefunden.');
            } else {
                toast.error('Fehler beim Laden des Übungsquiz.');
            }
            navigate('/');
        }
    };

    const submitPracticeAnswer = async (answer) => {
        if (!practiceQuiz) return;

        const question = practiceQuiz.questions[currentQuestionIndex];
        let answerToSubmit = answer;

        if (question.type === QUESTION_TYPES.TEXT && Array.isArray(answer)) {
            answerToSubmit = answer[0] || '';
        }

        try {
            const response = await postRequest(`/practice/${practiceCode}/submit-answer`, {
                attemptId,
                questionIndex: currentQuestionIndex,
                answer: answerToSubmit,
                name: practiceUserData?.name || username || 'Anonymous',
                character: practiceUserData?.character || 'wizard'
            });

            if (response.isLastQuestion) {
                setShowingPracticeResult(true);
                setPracticeQuestionResult({
                    result: response.result,
                    isLastQuestion: true,
                    finalResults: response.finalResults
                });
            } else {
                setPracticeQuestionResult({
                    result: response.result,
                    isLastQuestion: false
                });
                setShowingPracticeResult(true);
            }
        } catch (error) {
            console.error('Error submitting practice answer:', error);
            toast.error('Fehler beim Senden der Antwort.');
        }
    };

    const nextPracticeQuestion = () => {
        if (currentQuestionIndex < practiceQuiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelection([]);
            setShowingPracticeResult(false);
            setPracticeQuestionResult(null);
        }
    };

    const getPracticeQuestion = () => {
        return practiceQuiz?.questions[currentQuestionIndex] || null;
    };

    const getCurrentQuestion = () => {
        return isPracticeMode ? getPracticeQuestion() : currentQuestion;
    };

    const handleMultipleChoiceSelection = (index) => {
        setSelection(prevSelection => {
            const newSelection = [...prevSelection];
            newSelection[index] = !newSelection[index];
            if (newSelection.filter(value => value).length > 3) return prevSelection;
            return newSelection;
        });
    };

    const renderQuestionTypeContent = (question) => {
        switch (question.type) {
            case QUESTION_TYPES.TRUE_FALSE:
                return (
                    <div className="ingame-content true-false-layout">
                        <TrueFalseClient onSubmit={submitAnswer} />
                    </div>
                );
                
            case QUESTION_TYPES.TEXT:
                return (
                    <div className="ingame-content text-layout">
                        <TextInputClient onSubmit={submitAnswer} maxLength={question.maxLength || 200} />
                    </div>
                );
                
            case 'single':
            case QUESTION_TYPES.MULTIPLE_CHOICE:
                if (isPracticeMode) {
                    return (
                        <div className="ingame-content grid-layout">
                            {question.answers.map((answer, index) => (
                                <div key={index} className="ingame-answer" onClick={() => submitAnswer([index])}>
                                    {answer.type === "image" ? (
                                        <img src={answer.content} alt={`Answer ${index + 1}`} className="practice-answer-image" />
                                    ) : (
                                        <span className="practice-answer-text">{answer.content}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                }
                return (
                    <div className="ingame-content grid-layout">
                        {Array.from({length: question.answers}, (_, index) => (
                            <div key={index} className="ingame-answer" onClick={() => submitAnswer([index])}>
                                <FontAwesomeIcon icon={faCheckCircle} className={"ingame-icon"}/>
                            </div>
                        ))}
                    </div>
                );
                
            case QUESTION_TYPES.MULTIPLE_CHOICE:
            case 'multiple':
                if (isPracticeMode) {
                    return (
                        <div className="ingame-content grid-layout">
                            {question.answers.map((answer, index) => (
                                <div key={index} 
                                     className={`ingame-answer ${selection[index] ? 'ingame-answer-selected' : ''}`}
                                     onClick={() => handleMultipleChoiceSelection(index)}>
                                    {answer.type === "image" ? (
                                        <img src={answer.content} alt={`Answer ${index + 1}`} className="practice-answer-image" />
                                    ) : (
                                        <span className="practice-answer-text">{answer.content}</span>
                                    )}
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
                }
                return (
                    <div className="ingame-content grid-layout">
                        {Array.from({length: question.answers}, (_, index) => (
                            <div key={index} 
                                 className={`ingame-answer ${selection[index] ? 'ingame-answer-selected' : ''}`}
                                 onClick={() => handleMultipleChoiceSelection(index)}>
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
                return <div>Unbekannter Fragetyp: {question.type}</div>;
        }
    };

    const submitAnswer = (answers) => {
        if (isPracticeMode) {
            return submitPracticeAnswer(answers);
        }

        if (currentQuestion.type === QUESTION_TYPES.TEXT) {
            setSelection([answers]);
            setUserSubmittedAnswer(answers);
            setLastQuestionType(QUESTION_TYPES.TEXT);
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
            setLastQuestionType(currentQuestion.type);
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
        const questionType = currentQuestion?.type || lastQuestionType;
        
        if (questionType === QUESTION_TYPES.TEXT) {
            const userAnswer = userSubmittedAnswer || selection[0];
            
            if (Array.isArray(answers)) {
                return answers.some(correctAnswer => 
                    correctAnswer.toLowerCase().trim() === userAnswer?.toLowerCase().trim()
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
        const question = getCurrentQuestion();
        if (!question) return null;

        return renderQuestionTypeContent(question);
    };

    const shouldShowQuestion = () => {
        if (isPracticeMode) {
            return getCurrentQuestion() && !showingPracticeResult;
        }
        return currentQuestion !== null;
    };

    const shouldShowAnswers = () => {
        if (isPracticeMode) {
            return showingPracticeResult;
        }
        return currentQuestion === null && answers.length > 0;
    };

    return (
        <div className="ingame-client">
            {!isPracticeMode && (!isConnected || isReconnecting) && (
                <div className="connection-status">
                    <FontAwesomeIcon 
                        icon={isConnected ? faWifi : faExclamationTriangle} 
                        className={`connection-icon ${isReconnecting ? 'reconnecting' : 'disconnected'}`}
                    />
                    <span>{isReconnecting ? 'Verbinde wieder...' : 'Verbindung verloren'}</span>
                </div>
            )}
            
            {shouldShowQuestion() && (
                <div className="question-content-wrapper">
                    <div className="ingame-header">
                        {isPracticeMode && (
                            <div className="practice-progress">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{width: `${((currentQuestionIndex + 1) / practiceQuiz.questions.length) * 100}%`}}></div>
                                </div>
                                <span>Frage {currentQuestionIndex + 1} von {practiceQuiz.questions.length}</span>
                            </div>
                        )}
                        <h2>{getCurrentQuestion().title}</h2>
                    </div>
                    
                    {getCurrentQuestion().b64_image && (
                        <div className="question-image-container">
                            <img src={getCurrentQuestion().b64_image} alt={getCurrentQuestion().title} className="question-image" />
                        </div>
                    )}
                    
                    {renderAnswerContent()}
                </div>
            )}

            {!isPracticeMode && currentQuestion === null && answers.length === 0 && (
                <div className="loading-container">
                    <div className="lds-hourglass"></div>
                </div>
            )}

            {shouldShowAnswers() && (
                <div className="ingame-answers">
                    {isPracticeMode ? (
                        practiceQuestionResult?.isLastQuestion ? (
                            <>
                                <FontAwesomeIcon icon={faCheck} className="ingame-icon-correct"/>
                                <h2>Quiz abgeschlossen! 🎉</h2>
                                <div className="practice-final-score">
                                    <span className="score">{practiceQuestionResult.finalResults.score}</span>
                                    <span className="total">/ {practiceQuestionResult.finalResults.total}</span>
                                    <div className="percentage">
                                        {Math.round((practiceQuestionResult.finalResults.score / practiceQuestionResult.finalResults.total) * 100)}%
                                    </div>
                                </div>
                                <button className="practice-next-button" onClick={() => navigate('/')}>
                                    Zurück zur Startseite
                                </button>
                            </>
                        ) : (
                            <>
                                <FontAwesomeIcon 
                                    icon={
                                        practiceQuestionResult?.result === 'correct' ? faCheck :
                                        practiceQuestionResult?.result === 'partial' ? faMinus : faX
                                    }
                                    className={
                                        practiceQuestionResult?.result === 'correct' ? "ingame-icon-correct" :
                                        practiceQuestionResult?.result === 'partial' ? "ingame-icon-partial" : "ingame-icon-wrong"
                                    }
                                />
                                <h2>
                                    {practiceQuestionResult?.result === 'correct' ? "Richtig!" :
                                     practiceQuestionResult?.result === 'partial' ? "Teilweise richtig!" : "Weiter so!"}
                                </h2>
                                <button className="practice-next-button" onClick={nextPracticeQuestion}>
                                    Nächste Frage
                                </button>
                            </>
                        )
                    ) : (
                        <>
                            <FontAwesomeIcon icon={getCorrectStatus(selection, answers) === 1 ? faCheck : getCorrectStatus(selection, answers) === 0 ? faMinus : faX}
                                           className={getCorrectStatus(selection, answers) === 1 ? " ingame-icon-correct" : getCorrectStatus(selection, answers) === 0 ? " ingame-icon-partial" : " ingame-icon-wrong"}/>
                            <h2>
                                {getCorrectStatus(selection, answers) === 1 && "Richtig!"}
                                {getCorrectStatus(selection, answers) === 0 && "Teilweise richtig!"}
                                {getCorrectStatus(selection, answers) === -1 && "Falsch!"}
                            </h2>
                        </>
                    )}
                </div>
            )}

            <div className="ingame-footer">
                <h2>{isPracticeMode ? (practiceUserData?.name || 'Anonymous') : username}</h2>
                {!isPracticeMode && (
                    <div className="footer-points">
                        <h2>{points}</h2>
                    </div>
                )}
            </div>
        </div>
    );
}