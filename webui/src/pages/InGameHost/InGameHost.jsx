import {useContext, useEffect, useRef, useState} from "react";
import {socket} from "@/common/utils/SocketUtil.js";
import {QuizContext} from "@/common/contexts/Quiz";
import toast from "react-hot-toast";
import {useNavigate} from "react-router-dom";
import Answer from "@/pages/InGameHost/components/Answer";
import "./styles.sass";
import Question from "@/pages/InGameHost/components/Question";
import Button from "@/common/components/Button";
import {faForward, faUser} from "@fortawesome/free-solid-svg-icons";
import Scoreboard from "@/pages/InGameHost/components/Scoreboard";
import AnswerResults from "@/pages/InGameHost/components/AnswerResults";
import CountdownTimer from "@/pages/InGameHost/components/CountdownTimer";
import {DoublePointsAnimation} from "@/pages/InGameHost/components/DoublePointsAnimation";
import QuestionCountdown from "@/pages/InGameHost/components/QuestionCountdown";
import QuestionTypeTeaser from "@/pages/InGameHost/components/QuestionTypeTeaser";
import {useSoundManager} from "@/common/utils/SoundManager.js";
import SoundRenderer from "@/common/components/SoundRenderer";
import SoundControl from "@/common/components/SoundControl";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import WordCloud from '@/common/components/WordCloud';

export const InGameHost = () => {
    const {isLoaded, pullNextQuestion, scoreboard, setScoreboard, playerCount, setPlayerCount} = useContext(QuizContext);
    const navigate = useNavigate();
    const soundManager = useSoundManager();
    const inGameMusicRef = useRef(null);
    const lastAnsweredCountRef = useRef(0);

    const [currentQuestion, setCurrentQuestion] = useState({});
    const [gameState, setGameState] = useState('question');
    const [answerData, setAnswerData] = useState(null);
    const [wordCloud, setWordCloud] = useState({words: [], totalResponses: 0});
    const [questionAnimationState, setQuestionAnimationState] = useState('hidden');
    const [timerActive, setTimerActive] = useState(false);
    const [showDoublePointsAnimation, setShowDoublePointsAnimation] = useState(false);
    const [showQuestionCountdown, setShowQuestionCountdown] = useState(false);
    const [showTypeTeaser, setShowTypeTeaser] = useState(false);
    const [answerProgress, setAnswerProgress] = useState({
        answeredCount: 0,
        activePlayerCount: 0
    });

    const skipQuestion = async () => {
        try {
            setTimerActive(false);
            socket.emit("SKIP_QUESTION", null, (data) => {
                if (!data) {
                    toast.error("Fehler beim Überspringen der Frage");
                    return;
                }
                setScoreboard(data.scoreboard);
                setAnswerData(data.answerData);
                setGameState('answer-results');

                if (inGameMusicRef.current) {
                    soundManager.stopSound(inGameMusicRef.current);
                    inGameMusicRef.current = null;
                }
                soundManager.playTransition('RESULTS');
            });
        } catch (e) {
            console.error("Error skipping question:", e);
        }
    }

    const showScoreboard = () => {
        setGameState('scoreboard');
        if (inGameMusicRef.current) {
            soundManager.stopSound(inGameMusicRef.current);
            inGameMusicRef.current = null;
        }
        soundManager.playTransition('SCOREBOARD');
    }

    const nextQuestion = async () => {
        try {
            const newQuestion = await pullNextQuestion();
            setCurrentQuestion(newQuestion);
            setGameState('question');
            setAnswerData(null);
            setWordCloud({words: [], totalResponses: 0});
            setQuestionAnimationState('hidden');
            setTimerActive(false);
            setShowQuestionCountdown(false);
            setShowTypeTeaser(false);
            setAnswerProgress({answeredCount: 0, activePlayerCount: 0});
            lastAnsweredCountRef.current = 0;

            if (!inGameMusicRef.current && (gameState === 'answer-results' || gameState === 'scoreboard')) {
                inGameMusicRef.current = soundManager.playAmbient('INGAME');
            }

            soundManager.playTransition('QUESTION');
            
            const newQuestionCopy = {...newQuestion, b64_image: undefined};

            for (let i = 0; i < newQuestion.answers.length; i++) {
                delete newQuestion.answers[i].b64_image;
            }

            if (newQuestion.pointMultiplier === 'double' && newQuestion.type !== QUESTION_TYPES.WORD_CLOUD) {
                setShowDoublePointsAnimation(true);

                setTimeout(() => {
                    setShowDoublePointsAnimation(false);

                    socket.emit("SHOW_QUESTION", newQuestionCopy, (res) => {
                        if (!res?.success) toast.error(res?.error || "Fehler beim Anzeigen der Frage");
                    });
                    
                    startQuestionSequence();
                }, 3000);
            } else {
                socket.emit("SHOW_QUESTION", newQuestionCopy, (res) => {
                    if (!res?.success) toast.error(res?.error || "Fehler beim Anzeigen der Frage");
                });
                
                startQuestionSequence();
            }

            function startQuestionSequence() {
                setTimeout(() => {
                    setQuestionAnimationState('question-appear');
                }, 100);

                setTimeout(() => {
                    setShowTypeTeaser(true);
                }, 600);

                setTimeout(() => {
                    setShowTypeTeaser(false);
                    setShowQuestionCountdown(true);
                }, 2600);

                setTimeout(() => {
                    setShowQuestionCountdown(false);
                    setQuestionAnimationState('answers-ready');
                    if (newQuestion.timer !== -1) {
                        setTimerActive(true);
                    }
                }, 5600);
            }
        } catch (e) {
            socket.emit("END_GAME", null, (data) => {
                if (data) {
                    if (data.analytics) {
                        setScoreboard({
                            scoreboard: data.players,
                            analytics: data.analytics
                        });
                    } else if (data.players) {
                        setScoreboard({scoreboard: data.players});
                    }
                }

                if (inGameMusicRef.current) {
                    soundManager.stopSound(inGameMusicRef.current);
                    inGameMusicRef.current = null;
                }
                
                navigate("/host/ending");
            });
        }
    }


    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }

        inGameMusicRef.current = soundManager.playAmbient('INGAME');

        socket.on("PLAYER_LEFT", (player) => {
            toast.error(`${player.name} hat das Spiel verlassen`);
            soundManager.playFeedback('PLAYER_LEFT');
            setPlayerCount(count => Math.max(0, count - 1));
        });

        socket.on("ANSWERS_RECEIVED", (data) => {
            setTimerActive(false);
            setScoreboard(data.scoreboard);
            setAnswerData(data.answerData);
            setGameState('answer-results');

            if (inGameMusicRef.current) {
                soundManager.stopSound(inGameMusicRef.current);
                inGameMusicRef.current = null;
            }
            soundManager.playTransition('RESULTS');
        });

        socket.on("ANSWER_PROGRESS", (data) => {
            const newCount = data.answeredCount || 0;
            if (newCount > lastAnsweredCountRef.current) {
                soundManager.playFeedback('ANSWER_RECEIVED');
            }
            lastAnsweredCountRef.current = newCount;
            setAnswerProgress({
                answeredCount: newCount,
                activePlayerCount: data.activePlayerCount || 0
            });
        });

        socket.on('WORD_CLOUD_UPDATED', setWordCloud);

        const timeout = setTimeout(() => nextQuestion(), 500);

        return () => {
            socket.off("PLAYER_LEFT");
            socket.off("ANSWERS_RECEIVED");
            socket.off("ANSWER_PROGRESS");
            socket.off('WORD_CLOUD_UPDATED', setWordCloud);
            clearTimeout(timeout);

            if (inGameMusicRef.current) {
                soundManager.stopSound(inGameMusicRef.current);
                inGameMusicRef.current = null;
            }
        }
    }, [isLoaded]);

    return (
        <div>
            <SoundRenderer />
            <div className="ingame-sound-control">
                <Button icon={faUser} text={playerCount} padding="0.5rem 0.8rem"/>
                <SoundControl />
            </div>

            <DoublePointsAnimation 
                isVisible={showDoublePointsAnimation} 
                onComplete={() => setShowDoublePointsAnimation(false)}
            />

            <QuestionCountdown isActive={showQuestionCountdown} from={3} />

            <QuestionTypeTeaser isActive={showTypeTeaser} type={currentQuestion?.type} />

            {gameState === 'question' && questionAnimationState === 'answers-ready' && currentQuestion && (
                <CountdownTimer
                    duration={currentQuestion.timer === undefined || currentQuestion.timer === null ? 60 : 
                             currentQuestion.timer === -1 ? 0 : currentQuestion.timer}
                    onTimeUp={skipQuestion}
                    isActive={timerActive}
                />
            )}
            
            {gameState === 'answer-results' && answerData && (
                <AnswerResults 
                    question={currentQuestion} 
                    answerData={answerData}
                    showScoreboard={showScoreboard}
                />
            )}
            
            {gameState === 'scoreboard' && (
                <Scoreboard 
                    nextQuestion={nextQuestion} 
                    scoreboard={Object.values(scoreboard?.scoreboard || scoreboard || {})} 
                />
            )}
            
            {gameState === 'question' && (
                <div className="ingame-question">
                    {Object.keys(currentQuestion).length !== 0 && <div className="question-content-container">
                        <div className="top-area">
                            <Button onClick={skipQuestion} text="Frage überspringen"
                                    padding="1rem 1.5rem" icon={faForward} />
                        </div>
                        
                        <div className={`question-wrapper ${questionAnimationState}`}>
                            <Question title={currentQuestion.title} image={currentQuestion.b64_image}/>
                        </div>

                        {questionAnimationState === 'answers-ready' && (
                            <div className="answer-progress-panel">
                                <div className="answer-progress-counter">
                                    <span className="answer-progress-number">{answerProgress.answeredCount}</span>
                                    <span className="answer-progress-label">Antworten</span>
                                </div>
                            </div>
                        )}

                        {questionAnimationState === 'answers-ready' && currentQuestion.type !== QUESTION_TYPES.TEXT && currentQuestion.type !== QUESTION_TYPES.SEQUENCE && currentQuestion.type !== QUESTION_TYPES.SLIDER && currentQuestion.type !== QUESTION_TYPES.WORD_CLOUD && (
                            <div className={`answer-list ${questionAnimationState}`}>
                                {currentQuestion.answers.map((answer, index) => <Answer key={index} answer={answer}
                                                                                        index={index} questionType={currentQuestion.type}/>)}
                            </div>
                        )}

                        {questionAnimationState === 'answers-ready' && currentQuestion.type === QUESTION_TYPES.WORD_CLOUD && (
                            <WordCloud {...wordCloud}/>
                        )}

                        {questionAnimationState === 'answers-ready' && currentQuestion.type === QUESTION_TYPES.SLIDER && (
                            <div className={`text-question-indicator ${questionAnimationState}`}>
                                <h2>Spieler bewegen den Schieberegler...</h2>
                                <div className="slider-host-preview">
                                    <div className="slider-range-bar">
                                        <span className="range-label">{currentQuestion.answers?.[0]?.min ?? 0}</span>
                                        <div className="range-track">
                                            <div className="range-fill" />
                                        </div>
                                        <span className="range-label">{currentQuestion.answers?.[0]?.max ?? 100}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {questionAnimationState === 'answers-ready' && currentQuestion.type === QUESTION_TYPES.TEXT && (
                            <div className={`text-question-indicator ${questionAnimationState}`}>
                                <h2>Spieler geben ihre Antworten ein...</h2>
                                <div className="text-input-animation">
                                    <div className="typing-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {questionAnimationState === 'answers-ready' && currentQuestion.type === QUESTION_TYPES.SEQUENCE && (
                            <div className={`text-question-indicator ${questionAnimationState}`}>
                                <h2>Spieler sortieren ihre Antworten...</h2>
                                <div className="text-input-animation">
                                    <div className="typing-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>}
                </div>
            )}
        </div>
    );
}
