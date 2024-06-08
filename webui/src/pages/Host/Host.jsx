import {useContext, useEffect, useState} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate, useOutletContext} from "react-router-dom";
import "./styles.sass";
import QRCode from "qrcode.react";
import Triangle from "@/pages/Host/assets/Triangle.jsx";
import {BrandingContext} from "@/common/contexts/Branding";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import {faGamepad, faUser, faVolumeMute} from "@fortawesome/free-solid-svg-icons";
import {socket} from "@/common/utils/SocketUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export const Host = () => {
    const navigate = useNavigate();
    const {setCirclePosition} = useOutletContext();
    const {isLoaded, quizRaw} = useContext(QuizContext);
    const {titleImg} = useContext(BrandingContext);
    const [qrShown, setQrShown] = useState(false);

    const [roomCode, setRoomCode] = useState("0000");
    const [players, setPlayers] = useState([]);

    const getJoinUrl = () => {
        return window.location.href.split("/host")[0]
            + "/?code=" + roomCode;
    }

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }

        socket.emit("CREATE_ROOM", undefined, (roomCode) => {
            setRoomCode(roomCode);
        });

        socket.on("PLAYER_JOINED", (player) => {
            setPlayers(players => [...players, player]);
        });

        socket.on("PLAYER_LEFT", (player) => {
            setPlayers(players => players.filter(p => p.id !== player.id));
        });

        return () => {
            socket.off("PLAYER_JOINED");
            socket.off("PLAYER_LEFT");
        }
    }, [isLoaded]);

    const kickPlayer = (id) => {
        socket.emit("KICK_PLAYER", {id}, () => {});
    }

    const startGame = () => {
        if (players.length === 0) return;
        navigate("/host/ingame");
    }

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    }, []);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className="host-page">
            {qrShown && <div className="qr-dialog" onClick={() => setQrShown(!qrShown)}>
                <motion.div initial={{scale: 0}} animate={{scale: 1}}>
                    <QRCode value={getJoinUrl()} className="qr-big" renderAs="svg"/>
                </motion.div>
            </div>}

            <div className="quiz-info-container">
                <motion.div className="quiz-information" initial={{opacity: 0, y: -100}} animate={{opacity: 1, y: 0}}>
                    <div className="info-header">
                        <h1>“{quizRaw.title}”</h1>
                        <QRCode value={getJoinUrl()} size={100} renderAs="svg" className="qr"
                                onClick={() => setQrShown(!qrShown)}/>
                    </div>

                    <p>Verbinden über die Webseite <span>www.bs2ab.quiz</span> mit Code:</p>
                    <h2>{roomCode}</h2>

                    <Triangle/>
                </motion.div>
                <Button text="Starten" icon={faGamepad} padding="0.5rem 1rem" onClick={startGame} disabled={players.length === 0}/>
            </div>


            <motion.div className="member-info" initial={{opacity: 0, x: -100}} animate={{opacity: 1, x: 0}}>
                <img src={titleImg} alt="Quiz Logo" className="quiz-logo"/>
                {players.length === 0 && <h2>Warten auf Mitspieler...</h2>}

                <div className="player-list">
                    {players.map(player => (
                        <motion.div key={player.id} className="player" initial={{scale: 0}} animate={{scale: 1}}
                            onClick={() => kickPlayer(player.id)}>
                            <FontAwesomeIcon icon={faUser} />
                            <h3>{player.name}</h3>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            <motion.div className="system-ui" initial={{opacity: 0, y: 100}} animate={{opacity: 1, y: 0}}>
                <Button icon={faUser} text={players.length} padding="0.5rem 0.8rem"/>
                <Button icon={faVolumeMute} padding="0.5rem 0.8rem"/>
            </motion.div>
        </div>
    );
}