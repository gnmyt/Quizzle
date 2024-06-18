import "./styles.sass";
import {useContext, useEffect} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate} from "react-router-dom";
import Scoreboard from "@/pages/InGameHost/components/Scoreboard/index.js";

export const EndingHost = () => {
    const {isLoaded, scoreboard} = useContext(QuizContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }
    }, []);

    return (
        <div className="ending-page">
            <Scoreboard isEnd nextQuestion={() => {}} scoreboard={Object.values(scoreboard?.scoreboard || {})} />
        </div>
    )
}