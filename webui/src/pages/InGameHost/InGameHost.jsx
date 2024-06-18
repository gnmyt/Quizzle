import {useContext, useEffect, useState} from "react";
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
import Sound from "react-sound";
import InGameMusic from "./assets/music/ingame.wav";

export const InGameHost = () => {
    const {isLoaded, pullNextQuestion, scoreboard, setScoreboard} = useContext(QuizContext);
    const navigate = useNavigate();

    const [currentQuestion, setCurrentQuestion] = useState({});
    const [scoreboardState, setScoreboardState] = useState(false);

    const skipQuestion = async () => {
        try {
            socket.emit("SKIP_QUESTION", null, (data) => {
                if (!data) toast.error("Fehler beim Überspringen der Frage");
                setScoreboard(data);
            });
            setScoreboardState(true);
        } catch (e) {

        }
    }

    const nextQuestion = async () => {
        try {
            const newQuestion = await pullNextQuestion();
            setCurrentQuestion(newQuestion);
            setScoreboardState(false);
            const newQuestionCopy = {...newQuestion, b64_image: undefined};

            for (let i = 0; i < newQuestion.answers.length; i++) {
                delete newQuestion.answers[i].b64_image;
            }

            socket.emit("SHOW_QUESTION", newQuestionCopy, (success) => {
                if (!success) toast.error("Fehler beim Anzeigen der Frage");
            });
        } catch (e) {
            navigate("/host/ending");
        }
    }


    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }

        socket.on("PLAYER_LEFT", (player) => {
            toast.error(`${player.name} hat das Spiel verlassen`);
        });

        socket.on("ANSWERS_RECEIVED", () => {
            skipQuestion();
        });

        const timeout = setTimeout(() => nextQuestion(), 500);

        return () => {
            socket.off("PLAYER_LEFT");
            socket.off("ANSWERS_RECEIVED");
            clearTimeout(timeout);
        }
    }, [isLoaded]);

    return (
        <div>
            <Sound url={InGameMusic} playStatus={Sound.status.PLAYING} loop={true} volume={100} />
            {scoreboardState && <Scoreboard nextQuestion={nextQuestion} scoreboard={Object.values(scoreboard?.scoreboard || {})} />}
            {!scoreboardState && <div>
                {Object.keys(currentQuestion).length !== 0 && <div style={{
                    display: "flex", alignItems: "center",
                    flexDirection: "column"
                }}>
                    <div className="top-area">
                        <Button onClick={skipQuestion} text="Frage überspringen"
                                padding="1rem 1.5rem" icon={faForward} />
                    </div>
                    <Question title={currentQuestion.title} image={currentQuestion.b64_image}/>

                    <div className="answer-list">
                        {currentQuestion.answers.map((answer, index) => <Answer key={index} answer={answer}
                                                                                index={index}/>)}
                    </div>
                </div>}
            </div>}
        </div>
    );
}