import {useContext, useEffect, useState} from "react";
import {socket} from "@/common/utils/SocketUtil.js";
import {QuizContext} from "@/common/contexts/Quiz";
import toast from "react-hot-toast";
import {useNavigate} from "react-router-dom";
import Answer from "@/pages/InGameHost/components/Answer";
import "./styles.sass";
import {Question} from "@/pages/InGameHost/components/Question/Question.jsx";
import Button from "@/common/components/Button/index.js";
import {faForward, faQuestionCircle} from "@fortawesome/free-solid-svg-icons";
import Scoreboard from "@/pages/InGameHost/components/Scoreboard/index.js";

export const InGameHost = () => {
    const {isLoaded, pullNextQuestion} = useContext(QuizContext);
    const navigate = useNavigate();

    const [currentQuestion, setCurrentQuestion] = useState({});
    const [scoreboardState, setScoreboardState] = useState(false);
    const [currentScoreboard, setCurrentScoreboard] = useState([]);

    const skipQuestion = async () => {
        try {
            socket.emit("SKIP_QUESTION", null, (data) => {
                if (!data) toast.error("Fehler beim Überspringen der Frage");
                setCurrentScoreboard(data);
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
            socket.emit("SHOW_QUESTION", newQuestion, (success) => {
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
            {scoreboardState && <Scoreboard nextQuestion={nextQuestion} scoreboard={Object.values(currentScoreboard?.scoreboard || {})} />}
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