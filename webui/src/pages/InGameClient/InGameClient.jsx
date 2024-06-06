import "./styles.sass";
import {QuizContext} from "@/common/contexts/Quiz";
import {useContext, useEffect} from "react";
import {useNavigate} from "react-router-dom";

export const InGameClient = () => {
    const navigate = useNavigate();
    const {roomCode} = useContext(QuizContext);

    useEffect(() => {
        if (roomCode === null) navigate("/");
    }, [roomCode]);

    return (
        <div className="ingame-client">
            <h1>Client</h1>
        </div>
    );
}