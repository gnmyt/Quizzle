import {useContext, useEffect} from "react";
import {socket} from "@/common/utils/SocketUtil.js";
import {QuizContext} from "@/common/contexts/Quiz";
import toast from "react-hot-toast";
import {useNavigate} from "react-router-dom";

export const InGameHost = () => {
    const {isLoaded} = useContext(QuizContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }

        socket.on("PLAYER_LEFT", (player) => {
            console.log(player)
            toast.error(`${player.name} hat das Spiel verlassen`);
        });

        return () => {
            socket.off("PLAYER_LEFT");
        }
    }, [isLoaded]);

    return (
        <div>
            <h1>Game is running</h1>
        </div>
    );
}