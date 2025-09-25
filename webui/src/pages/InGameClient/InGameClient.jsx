import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect, useState} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck, faCheckCircle, faMinus, faPaperPlane, faX} from "@fortawesome/free-solid-svg-icons";
import {TrueFalseClient} from "./components/TrueFalseClient";
import {TextInputClient} from "./components/TextInputClient";
import {jsonRequest, postRequest} from "@/common/utils/RequestUtil.js";
import toast from "react-hot-toast";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {username, roomCode} = useContext(QuizContext);
    const {practiceCode} = useParams();
    const [searchParams] = useSearchParams();

    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [practiceQuiz, setPracticeQuiz] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showingPracticeResult, setShowingPracticeResult] = useState(false);
    const [practiceQuestionResult, setPracticeQuestionResult] = useState(null);
    const [attemptId] = useState(() => crypto.randomUUID());

    const [points, setPoints] = useState(0);
    const [selection, setSelection] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [answers, setAnswers] = useState([]);

    useEffect(() => {
        if (practiceCode) {
            setIsPracticeMode(true);
            loadPracticeQuiz();
            return;
        }

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
            setCurrentQuestion(null);
        }

        const gameEnded = () => {
            socket.off("QUESTION_RECEIVED", onQuestion);
            socket.off("POINTS_RECEIVED", onPoints);
            socket.off("ANSWER_RECEIVED", onAnswer);
            socket.off("GAME_ENDED", gameEnded);
            socket.off("disconnect", gameEnded);
            
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

        if (question.type === 'text' && Array.isArray(answer)) {
            answerToSubmit = answer[0] || '';
        }

        try {
            const name = searchParams.get('name');
            const character = searchParams.get('character');
            
            const response = await postRequest(`/practice/${practiceCode}/submit-answer`, {
                attemptId,
                questionIndex: currentQuestionIndex,
                answer: answerToSubmit,
                name: name || username || 'Anonymous',
                character: character || 'wizard'
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
            case 'true-false':
                return (
                    <div className="ingame-content true-false-layout">
                        <TrueFalseClient onSubmit={submitAnswer} />
                    </div>
                );
                
            case 'text':
                return (
                    <div className="ingame-content text-layout">
                        <TextInputClient onSubmit={submitAnswer} maxLength={question.maxLength || 200} />
                    </div>
                );
                
            case 'single':
            case 'single-choice':
                if (isPracticeMode) {
                    return (
                        <div className="ingame-content grid-layout">
                            {question.answers.map((answer, index) => (
                                <div key={index} className="ingame-answer" onClick={() => submitAnswer([index])}>
                                    <span className="practice-answer-text">{answer.content}</span>
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
                
            case 'multiple-choice':
            case 'multiple':
                if (isPracticeMode) {
                    return (
                        <div className="ingame-content grid-layout">
                            {question.answers.map((answer, index) => (
                                <div key={index} 
                                     className={`ingame-answer ${selection[index] ? 'ingame-answer-selected' : ''}`}
                                     onClick={() => handleMultipleChoiceSelection(index)}>
                                    <span className="practice-answer-text">{answer.content}</span>
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
            {shouldShowQuestion() && (
                <>
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
                    {renderAnswerContent()}
                </>
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

                            {getCorrectStatus(selection, answers) === 0 && Array.isArray(answers) && !currentQuestion?.type === 'text' && 
                                <h3>Richtige Antworten: {answers.map((value, index) => value ? index + 1 : null).filter(value => value !== null).join(", ")}</h3>}
                            
                            {currentQuestion?.type === 'text' && getCorrectStatus(selection, answers) === -1 && Array.isArray(answers) &&
                                <h3>Richtige Antworten: {answers.join(", ")}</h3>}
                        </>
                    )}
                </div>
            )}

            <div className="ingame-footer">
                <h2>{isPracticeMode ? searchParams.get('name') : username}</h2>
                {!isPracticeMode && (
                    <div className="footer-points">
                        <h2>{points}</h2>
                    </div>
                )}
            </div>
        </div>
    );
}