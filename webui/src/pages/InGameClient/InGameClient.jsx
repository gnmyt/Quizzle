import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {socket, addReconnectionCallback, removeReconnectionCallback, clearCurrentSession, getSessionManager, getSessionState} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCheckCircle, faMinus, faPaperPlane, faX, faWifi, faExclamationTriangle, faFire} from "@fortawesome/free-solid-svg-icons";
import AnswerShape from "@/common/components/AnswerShape";
import {TrueFalseClient} from "./components/TrueFalseClient";
import {TextInputClient} from "./components/TextInputClient";
import {SequenceClient} from "./components/SequenceClient";
import SliderClient from "./components/SliderClient";
import ClientAnswerReview from "./components/ClientAnswerReview";
import {jsonRequest, postRequest} from "@/common/utils/RequestUtil.js";
import {generateUuid} from "@/common/utils/UuidUtil.js";
import {QUESTION_TYPES, SLIDER_MARGIN_CONFIG, WORD_CLOUD_MAX_LENGTH} from "@/common/constants/QuestionTypes.js";
import WordCloud from '@/common/components/WordCloud';
import {useSoundManager} from "@/common/utils/SoundManager.js";
import toast from "react-hot-toast";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {username, roomCode, practiceUserData} = useContext(QuizContext);
    const {practiceCode} = useParams();
    const soundManager = useSoundManager();

    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [practiceQuiz, setPracticeQuiz] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showingPracticeResult, setShowingPracticeResult] = useState(false);
    const [practiceQuestionResult, setPracticeQuestionResult] = useState(null);
    const [attemptId] = useState(() => generateUuid());

    const [points, setPoints] = useState(0);
    const [pointsEarned, setPointsEarned] = useState(0);
    const [rank, setRank] = useState(null);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [streak, setStreak] = useState(0);
    const [playerAhead, setPlayerAhead] = useState(null);
    const [selection, setSelection] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [answerLabels, setAnswerLabels] = useState([]);
    const [lastQuestionType, setLastQuestionType] = useState(null);
    const [userSubmittedAnswer, setUserSubmittedAnswer] = useState(null);
    const [sliderAnswerData, setSliderAnswerData] = useState(null);
    const [wordCloud, setWordCloud] = useState(null);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [answersReady, setAnswersReady] = useState(false);
    const [clientCountdown, setClientCountdown] = useState(5);

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

        if (!roomCode && !sessionManager.hasValidSession()) {
            navigate("/");
            return;
        }
        
        if (!roomCode && sessionManager.hasValidSession()) {
            getSessionState().then(sessionState => {
                if (sessionState && sessionState.roomCode) {
                } else {
                    sessionManager.clearSession();
                    navigate("/");
                }
            }).catch(() => {
                navigate("/");
            });
        }

        const onQuestion = (question) => {
            setWordCloud(null);
            setAnswers([]);
            setAnswerLabels([]);
            setSliderAnswerData(null);
            setSelection([]);
            setUserSubmittedAnswer(null);
            setCurrentQuestion(question);
            setLastQuestionType(question?.type || null);
            setAnswersReady(false);
            setClientCountdown(5);
            setPointsEarned(0);

            const countdownInterval = setInterval(() => {
                setClientCountdown(prev => {
                    const newValue = prev - 1;
                    if (newValue <= 3 && newValue > 0) {
                        soundManager.playFeedback('TIMER_TICK');
                    }
                    if (newValue <= 0) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return newValue;
                });
            }, 1000);
        }

        const onPoints = (data) => {
            if (typeof data === 'object' && data !== null) {
                setPoints(data.points);
                setPointsEarned(data.pointsEarned || 0);
                setRank(data.rank || null);
                setTotalPlayers(data.totalPlayers || 0);
                setStreak(data.streak || 0);
                setPlayerAhead(data.ahead || null);
            } else {
                setPoints(data);
            }
        }

        const onAnswer = (answer) => {
            if (answer?.type === QUESTION_TYPES.WORD_CLOUD) {
                setWordCloud(answer);
                setAnswers([]);
                setSliderAnswerData(null);
            } else if (answer?.correctValue !== undefined) {
                setSliderAnswerData(answer);
                setAnswers([]);
                setAnswerLabels([]);
            } else {
                setAnswers(answer?.answers || []);
                setAnswerLabels(Array.isArray(answer?.answerLabels) ? answer.answerLabels : []);
            }
            setCurrentQuestion(null);
        }

        const onAnswersReady = () => {
            setAnswersReady(true);
        }

        const gameEnded = () => {
            clearCurrentSession();
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("ANSWERS_READY", onAnswersReady);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("disconnect", handleDisconnect);
            socket.off("HOST_DISCONNECTED", hostDisconnected);
            socket.off("KICKED_FROM_ROOM", kickedFromRoom);
            
            navigate("/");
        }

        const hostDisconnected = () => {
            clearCurrentSession();
            toast.error("Der Host hat das Spiel verlassen.", {
                duration: 3000
            });
            setTimeout(() => navigate("/"), 1000);
        }

        const kickedFromRoom = () => {
            clearCurrentSession();
            toast.error("Du wurdest aus dem Raum entfernt.", {
                duration: 3000
            });
            setTimeout(() => navigate("/"), 1000);
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

        const handleReconnection = (success, error, gameState) => {
            if (success) {
                setIsReconnecting(false);
                toast.success("Erfolgreich wieder verbunden!", { duration: 3000 });
                
                if (gameState) {
                    if (gameState.playerPoints !== undefined) {
                        setPoints(gameState.playerPoints);
                    }
                }
            } else {
                setIsReconnecting(true);
                
                if (error === 'Session expired' || 
                    error === 'Max reconnection attempts reached' ||
                    error === 'Session invalid - redirect required' ||
                    error === 'Host disconnected' ||
                    error === 'Kicked from room') {
                    
                    clearCurrentSession();
                    
                    let message = "Sitzung abgelaufen. Zurück zur Startseite...";
                    if (error === 'Kicked from room') {
                        message = "Du wurdest aus dem Raum entfernt. Zurück zur Startseite...";
                    } else if (error === 'Host disconnected') {
                        message = "Der Host hat das Spiel verlassen. Zurück zur Startseite...";
                    }
                    
                    toast.error(message, { duration: 2000 });
                    setTimeout(() => navigate("/"), 500);
                } else {
                    toast.error("Verbindung unterbrochen. Versuche wieder zu verbinden...", { duration: 2000 });
                }
            }
        };

        socket.on('GAME_STATE_RESTORED', (gameState) => {
            if (gameState.playerPoints !== undefined) {
                setPoints(gameState.playerPoints);
            }
        });

        const handleSessionRestored = () => {
            getSessionState().then(sessionState => {
                if (!sessionState && !roomCode) {
                    navigate("/");
                }
            });
        };

        handleSessionRestored();

        socket.on("QUESTION_RECEIVED", onQuestion);
        socket.on("POINTS_RECEIVED", onPoints);
        socket.on("ANSWER_RECEIVED", onAnswer);
        socket.on("ANSWERS_READY", onAnswersReady);
        socket.on("GAME_ENDED", gameEnded);
        socket.on("HOST_DISCONNECTED", hostDisconnected);
        socket.on("KICKED_FROM_ROOM", kickedFromRoom);
        socket.on("disconnect", handleDisconnect);
        socket.on('connect', handleConnect);
        addReconnectionCallback(handleReconnection);

        return () => {
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("ANSWERS_READY", onAnswersReady);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("HOST_DISCONNECTED", hostDisconnected);
            socket.off("KICKED_FROM_ROOM", kickedFromRoom);
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
        } else if (question.type === QUESTION_TYPES.SEQUENCE && Array.isArray(answer)) {
            answerToSubmit = answer;
        }

        try {
            const response = await postRequest(`/practice/${practiceCode}/submit-answer`, {
                attemptId,
                questionIndex: currentQuestionIndex,
                answer: answerToSubmit,
                name: practiceUserData?.name || username || 'Anonymous',
                character: practiceUserData?.character || 'wizard'
            });

            setPracticeQuestionResult(response);
            setShowingPracticeResult(true);
        } catch (error) {
            console.error('Error submitting practice answer:', error);
            toast.error('Fehler beim Senden der Antwort.');
        }
    };

    const nextPracticeQuestion = () => {
        if (currentQuestionIndex < practiceQuiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelection([]);
            setUserSubmittedAnswer(null);
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

    const getSliderResultStatus = (submittedValue, sliderAnswerData) => {
        if (!sliderAnswerData || sliderAnswerData.correctValue === undefined) return 0;

        const userValue = Number(submittedValue);
        const correctValue = Number(sliderAnswerData.correctValue);
        const min = Number(sliderAnswerData.min);
        const max = Number(sliderAnswerData.max);

        if (!Number.isFinite(userValue) || !Number.isFinite(correctValue)) return 0;

        const range = max - min;
        const distance = Math.abs(userValue - correctValue);
        const marginKey = sliderAnswerData.answerMargin || 'medium';
        const marginFactor = SLIDER_MARGIN_CONFIG[marginKey]?.factor ?? 0.1;

        if (distance === 0) return 1;
        if (marginKey === 'none') return -1;
        if (range <= 0) return -1;

        if (marginKey === 'maximum') {
            const score = Math.max(0, 1 - (distance / range));
            if (score >= 0.9) return 1;
            if (score >= 0.6) return 0;
            return -1;
        }

        const margin = range * marginFactor;
        if (margin <= 0 || distance > margin) return -1;

        const score = 1 - (distance / margin) * 0.5;
        return score >= 0.9 ? 1 : 0;
    };

    const renderQuestionTypeContent = (question) => {
        switch (question.type) {
            case QUESTION_TYPES.WORD_CLOUD:
                return (
                    <div className="ingame-content text-layout">
                        <TextInputClient key={isPracticeMode ? currentQuestionIndex : question.title}
                                         onSubmit={submitAnswer} maxLength={WORD_CLOUD_MAX_LENGTH}
                                         placeholder="Ein Begriff oder eine kurze Wortgruppe..."/>
                    </div>
                );

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

            case QUESTION_TYPES.SEQUENCE:
                return (
                    <div className="ingame-content sequence-layout">
                        <SequenceClient question={question} onSubmit={submitAnswer} />
                    </div>
                );

            case QUESTION_TYPES.SLIDER:
                return (
                    <div className="ingame-content slider-layout">
                        <SliderClient question={question} onSubmit={submitAnswer} />
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
                                <AnswerShape index={index} size="4.5rem"/>
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
                                <AnswerShape index={index} size={selection[index] ? "5.5rem" : "4.5rem"}/>
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
        const questionForSubmit = getCurrentQuestion();
        const typeForSubmit = questionForSubmit?.type;

        if (typeForSubmit === QUESTION_TYPES.TEXT || typeForSubmit === QUESTION_TYPES.WORD_CLOUD) {
            const textValue = Array.isArray(answers) ? (answers[0] || '') : answers;
            setUserSubmittedAnswer(textValue);
            setSelection([textValue]);
        } else if (typeForSubmit === QUESTION_TYPES.SLIDER) {
            setUserSubmittedAnswer(answers);
            setSelection([answers]);
        } else if (typeForSubmit === QUESTION_TYPES.SEQUENCE) {
            setUserSubmittedAnswer(Array.isArray(answers) ? [...answers] : answers);
            setSelection(Array.isArray(answers) ? [...answers] : []);
        } else {
            const indexArray = Array.isArray(answers) ? answers : [answers];
            let answerCount = indexArray.length;
            if (typeof questionForSubmit?.answers === 'number') {
                answerCount = questionForSubmit.answers;
            } else if (Array.isArray(questionForSubmit?.answers)) {
                answerCount = questionForSubmit.answers.length;
            }
            const boolSelection = Array.from({length: answerCount}, (_, index) => indexArray.includes(index));
            setUserSubmittedAnswer(indexArray);
            setSelection(boolSelection);
        }
        if (typeForSubmit) setLastQuestionType(typeForSubmit);

        if (isPracticeMode) {
            return submitPracticeAnswer(answers);
        }

        if (!answersReady) {
            toast.error("Antworten sind noch nicht bereit!");
            return;
        }

        socket.emit("SUBMIT_ANSWER", {answers}, (response) => {
            if (!response.success) {
                toast.error(response.error || "Fehler beim Senden der Antwort");
                return;
            }
            setCurrentQuestion(null);
        });
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

        if (questionType === QUESTION_TYPES.SLIDER) {
            const userVal = userSubmittedAnswer ?? selection[0];
            return getSliderResultStatus(userVal, sliderAnswerData);
        }

        if (questionType === QUESTION_TYPES.SEQUENCE) {
            const userOrder = userSubmittedAnswer || selection;
            const correctOrder = Array.from({length: userOrder.length}, (_, i) => i);

            if (userOrder.length === correctOrder.length) {
                let isCompletelyCorrect = true;
                for (let i = 0; i < userOrder.length; i++) {
                    if (userOrder[i] !== correctOrder[i]) {
                        isCompletelyCorrect = false;
                        break;
                    }
                }
                
                if (isCompletelyCorrect) {
                    return 1;
                } else {
                    let correctPositions = 0;
                    for (let i = 0; i < userOrder.length; i++) {
                        if (userOrder[i] === correctOrder[i]) {
                            correctPositions++;
                        }
                    }
                    
                    if (correctPositions > 0) {
                        return 0;
                    } else {
                        return -1;
                    }
                }
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
        return currentQuestion === null && (answers.length > 0 || sliderAnswerData !== null || wordCloud !== null);
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

            {!isPracticeMode && currentQuestion && !answersReady && (
                <div className="answers-not-ready-overlay">
                    <div className="countdown-message">
                        <div className="countdown-spinner">
                            <div className="countdown-number">{clientCountdown > 0 ? clientCountdown : <FontAwesomeIcon icon={faCheck} />}</div>
                            <div className="countdown-circle"></div>
                            <div className="spinner-background"></div>
                        </div>
                    </div>
                </div>
            )}

            {!isPracticeMode && currentQuestion === null && answers.length === 0 && sliderAnswerData === null && wordCloud === null && (
                <div className={`loading-container${lastQuestionType === QUESTION_TYPES.WORD_CLOUD && userSubmittedAnswer !== null ? ' word-cloud-waiting' : ''}`}>
                    {lastQuestionType === QUESTION_TYPES.WORD_CLOUD && userSubmittedAnswer !== null
                        ? <><h2>Dein Begriff wurde gesendet.</h2><p>{userSubmittedAnswer}</p><p>Die gemeinsame Wortwolke erscheint gleich.</p></>
                        : <div className="lds-hourglass"></div>}
                </div>
            )}

            {shouldShowAnswers() && (
                <div className={`ingame-answers${wordCloud !== null || practiceQuestionResult?.result === 'ungraded' ? ' word-cloud-results' : ''}`}>
                    {isPracticeMode ? (
                        practiceQuestionResult?.result === 'ungraded' ? (
                            <>
                                <h2>Danke für deinen Beitrag!</h2>
                                <WordCloud {...practiceQuestionResult.wordCloud}/>
                                {practiceQuestionResult.isLastQuestion && <h2>Quiz abgeschlossen!</h2>}
                                {practiceQuestionResult.isLastQuestion && practiceQuestionResult.finalResults.total > 0 && (
                                    <p>{practiceQuestionResult.finalResults.score} / {practiceQuestionResult.finalResults.total} Punkte</p>
                                )}
                                <button className="practice-next-button" onClick={practiceQuestionResult.isLastQuestion ? () => navigate('/') : nextPracticeQuestion}>
                                    {practiceQuestionResult.isLastQuestion ? 'Zurück zur Startseite' : 'Nächste Frage'}
                                </button>
                            </>
                        ) : practiceQuestionResult?.isLastQuestion ? (
                            <>
                                <FontAwesomeIcon icon={faCheck} className="ingame-icon-correct"/>
                                <h2>Quiz abgeschlossen! 🎉</h2>
                                <div className="practice-final-score">
                                    <span className="score">{practiceQuestionResult.finalResults.score}</span>
                                    <span className="total">/ {practiceQuestionResult.finalResults.total}</span>
                                    <div className="percentage">
                                        {practiceQuestionResult.finalResults.total > 0 ? `${Math.round((practiceQuestionResult.finalResults.score / practiceQuestionResult.finalResults.total) * 100)}%` : 'Ohne Bewertung'}
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
                                <ClientAnswerReview
                                    questionType={getPracticeQuestion()?.type}
                                    selection={selection}
                                    userSubmittedAnswer={userSubmittedAnswer}
                                    practiceQuestion={getPracticeQuestion()}
                                />
                                <button className="practice-next-button" onClick={nextPracticeQuestion}>
                                    Nächste Frage
                                </button>
                            </>
                        )
                    ) : wordCloud !== null ? (
                        <><h2>Unsere Wortwolke</h2><WordCloud {...wordCloud}/></>
                    ) : (
                        (() => {
                            const status = getCorrectStatus(selection, answers);
                            const statusClass = status === 1 ? 'result-correct' : status === 0 ? 'result-partial' : 'result-wrong';
                            const statusIcon = status === 1 ? faCheck : status === 0 ? faMinus : faX;
                            const statusTitle = status === 1 ? 'Richtig!' : status === 0 ? 'Fast richtig!' : 'Nicht ganz!';
                            const pointsColorClass = status === 1 ? 'points-correct' : status === 0 ? 'points-partial' : 'points-wrong';
                            return (
                                <div className="result-reveal">
                                    <div className={`result-icon-wrapper ${statusClass}`}>
                                        <FontAwesomeIcon icon={statusIcon} className="result-icon"/>
                                    </div>

                                    <h2 className="result-title">{statusTitle}</h2>

                                    {pointsEarned > 0 && (
                                        <span className={`points-earned ${pointsColorClass}`}>+{pointsEarned}</span>
                                    )}

                                    <ClientAnswerReview
                                        questionType={lastQuestionType}
                                        selection={selection}
                                        userSubmittedAnswer={userSubmittedAnswer}
                                        revealAnswers={answers}
                                        answerLabels={answerLabels}
                                        sliderAnswerData={sliderAnswerData}
                                    />

                                    {streak >= 2 && (
                                        <div className="result-card streak-card">
                                            <div className="streak-card-header">
                                                <div className="streak-card-title">
                                                    <span className="streak-number">{streak}</span>
                                                    <span className="streak-label">Richtige in Folge</span>
                                                </div>
                                                <div className="streak-badge">
                                                    <FontAwesomeIcon icon={faFire}/>
                                                    <span>{streak}</span>
                                                </div>
                                            </div>
                                            <div className="streak-bars">
                                                {Array.from({length: Math.max(5, streak)}, (_, i) => (
                                                    <div key={i} className={`streak-bar ${i < streak ? 'streak-bar-filled' : ''}`}/>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {rank && (
                                        <div className="result-card rank-card">
                                            <div className="rank-badge">{rank}.</div>
                                            <div className="rank-info">
                                                <span className="rank-main">Platz {rank} von {totalPlayers}</span>
                                                <span className="rank-sub">
                                                    {playerAhead && playerAhead.gap >= 0
                                                        ? `${playerAhead.gap} Punkte bis zum nächsten Platz`
                                                        : rank === 1
                                                            ? 'Du führst!'
                                                            : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()
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
