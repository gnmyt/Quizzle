import {useContext, useEffect, useRef, useState} from "react";
import {socket} from "@/common/utils/SocketUtil.js";
import {QuizContext} from "@/common/contexts/Quiz";
import toast from "react-hot-toast";
import {useNavigate} from "react-router-dom";
import Answer from "@/pages/InGameHost/components/Answer";
import "./styles.sass";
import {Question} from "@/pages/InGameHost/components/Question/Question.jsx";
import Button from "@/common/components/Button";
import {faForward} from "@fortawesome/free-solid-svg-icons";
import Scoreboard from "@/pages/InGameHost/components/Scoreboard";
import AnswerResults from "@/pages/InGameHost/components/AnswerResults";
import {useSoundManager} from "@/common/utils/SoundManager.js";
import SoundRenderer from "@/common/components/SoundRenderer";

export const InGameHost = () => {
    const {isLoaded, pullNextQuestion, scoreboard, setScoreboard} = useContext(QuizContext);
    const navigate = useNavigate();
    const soundManager = useSoundManager();
    const inGameMusicRef = useRef(null);

    const [currentQuestion, setCurrentQuestion] = useState({});
    const [gameState, setGameState] = useState('question');
    const [answerData, setAnswerData] = useState(null);

    const skipQuestion = async () => {
        try {
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

            if (!inGameMusicRef.current && (gameState === 'answer-results' || gameState === 'scoreboard')) {
                inGameMusicRef.current = soundManager.playAmbient('INGAME');
            }

            soundManager.playTransition('QUESTION');
            
            const newQuestionCopy = {...newQuestion, b64_image: undefined};

            for (let i = 0; i < newQuestion.answers.length; i++) {
                delete newQuestion.answers[i].b64_image;
            }

            socket.emit("SHOW_QUESTION", newQuestionCopy, (success) => {
                if (!success) toast.error("Fehler beim Anzeigen der Frage");
            });
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
        });

        socket.on("ANSWERS_RECEIVED", (data) => {
            setScoreboard(data.scoreboard);
            setAnswerData(data.answerData);
            setGameState('answer-results');

            if (inGameMusicRef.current) {
                soundManager.stopSound(inGameMusicRef.current);
                inGameMusicRef.current = null;
            }
            soundManager.playTransition('RESULTS');
        });

        const timeout = setTimeout(() => nextQuestion(), 500);

        return () => {
            socket.off("PLAYER_LEFT");
            socket.off("ANSWERS_RECEIVED");
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
                <div>
                    {Object.keys(currentQuestion).length !== 0 && <div style={{
                        display: "flex", alignItems: "center",
                        flexDirection: "column"
                    }}>
                        <div className="top-area">
                            <Button onClick={skipQuestion} text="Frage überspringen"
                                    padding="1rem 1.5rem" icon={faForward} />
                        </div>
                        <Question title={currentQuestion.title} image={currentQuestion.b64_image}/>

                        {currentQuestion.type !== 'text' && (
                            <div className="answer-list">
                                {currentQuestion.answers.map((answer, index) => <Answer key={index} answer={answer}
                                                                                        index={index}/>)}
                            </div>
                        )}

                        {currentQuestion.type === 'text' && (
                            <div className="text-question-indicator">
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
                    </div>}
                </div>
            )}
        </div>
    );
}