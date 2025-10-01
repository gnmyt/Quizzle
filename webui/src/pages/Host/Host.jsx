import {useContext, useEffect, useState} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate, useOutletContext} from "react-router-dom";
import "./styles.sass";
import {QRCodeSVG} from "qrcode.react";
import Triangle from "@/pages/Host/assets/Triangle.jsx";
import {BrandingContext} from "@/common/contexts/Branding";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import {faGamepad, faUser, faVolumeMute, faVolumeUp} from "@fortawesome/free-solid-svg-icons";
import {socket} from "@/common/utils/SocketUtil.js";
import {getCharacterEmoji} from "@/common/data/characters";
import {useSoundManager} from "@/common/utils/SoundManager.js";
import SoundRenderer from "@/common/components/SoundRenderer";

export const Host = () => {
    const navigate = useNavigate();
    const {setCirclePosition} = useOutletContext();
    const {isLoaded, quizRaw, soundEnabled, toggleSound} = useContext(QuizContext);
    const {titleImg} = useContext(BrandingContext);
    const soundManager = useSoundManager();
    const [qrShown, setQrShown] = useState(false);

    const [roomCode, setRoomCode] = useState("0000");
    const [players, setPlayers] = useState([]);
    const [lobbyAmbientId, setLobbyAmbientId] = useState(null);

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
            soundManager.playFeedback('PLAYER_JOINED');
        });

        socket.on("PLAYER_LEFT", (player) => {
            setPlayers(players => players.filter(p => p.id !== player.id));
            soundManager.playFeedback('PLAYER_LEFT');
        });

        socket.on("PLAYER_DISCONNECTED", (player) => {
            if (player.temporary) {
                setPlayers(players => players.map(p => p.id === player.id ? {...p, disconnected: true} : p));
            } else {
                setPlayers(players => players.filter(p => p.id !== player.id));
                soundManager.playFeedback('PLAYER_LEFT');
            }
        });

        socket.on("PLAYER_RECONNECTED", (player) => {
            setPlayers(players => {
                if (player.oldId) {
                    return players.map(p => p.id === player.oldId ? {...player, disconnected: false} : p);
                } else {
                    const existingPlayer = players.find(p => p.name === player.name);
                    if (existingPlayer) {
                        return players.map(p => p.name === player.name ? {...player, disconnected: false} : p);
                    } else {
                        return [...players, player];
                    }
                }
            });
        });

        return () => {
            socket.off("PLAYER_JOINED");
            socket.off("PLAYER_LEFT");
            socket.off("PLAYER_DISCONNECTED");
            socket.off("PLAYER_RECONNECTED");

            if (lobbyAmbientId) {
                soundManager.stopSound(lobbyAmbientId);
            }
        }
    }, [isLoaded]);

    const kickPlayer = (id) => {
        socket.emit("KICK_PLAYER", {id}, () => {
        });
    }

    const startGame = () => {
        if (players.length === 0) return;

        if (lobbyAmbientId) {
            soundManager.stopSound(lobbyAmbientId);
            setLobbyAmbientId(null);
        }
        
        navigate("/host/ingame");
    }

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);

        const ambientId = soundManager.playAmbient('LOBBY');
        setLobbyAmbientId(ambientId);
        
        return () => {
            if (ambientId) {
                soundManager.stopSound(ambientId);
            }
        };
    }, []);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className="host-page">
            {qrShown && <div className="qr-dialog" onClick={() => setQrShown(!qrShown)}>
                <motion.div initial={{scale: 0}} animate={{scale: 1}}>
                    <QRCodeSVG value={getJoinUrl()} className="qr-big"/>
                </motion.div>
            </div>}

            <div className="quiz-info-container">
                <motion.div className="quiz-information" initial={{opacity: 0, y: -100}} animate={{opacity: 1, y: 0}}>
                    <div className="info-header">
                        <h1>“{quizRaw.title}”</h1>
                        <QRCodeSVG value={getJoinUrl()} size={100} className="qr"
                                onClick={() => setQrShown(!qrShown)}/>
                    </div>

                    <p>Verbinden über die Webseite <span>{location.host.split(":")[0]}</span> mit Code:</p>
                    <h2>{roomCode}</h2>

                    <Triangle/>
                </motion.div>
                <Button text="Starten" icon={faGamepad} padding="0.5rem 1rem" onClick={startGame}
                        disabled={players.length === 0}/>
            </div>


            <motion.div className="member-info" initial={{opacity: 0, x: -100}} animate={{opacity: 1, x: 0}}>
                <img src={titleImg} alt="Quiz Logo" className="quiz-logo"/>
                {players.length === 0 && <h2>Warten auf Mitspieler...</h2>}

                <div className="player-list">
                    {players.map(player => (
                        <motion.div
                            key={player.id}
                            className={`player ${player.disconnected ? 'disconnected' : ''}`}
                            initial={{scale: 0}}
                            animate={{scale: 1}}
                            onClick={() => !player.disconnected && kickPlayer(player.id)}
                        >
                            <div className="player-character">{getCharacterEmoji(player.character)}</div>
                            <h3>{player.name}</h3>
                            {player.disconnected && (
                                <div className="disconnected-indicator"></div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            <motion.div className="system-ui" initial={{opacity: 0, y: 100}} animate={{opacity: 1, y: 0}}>
                <Button icon={faUser} text={players.length} padding="0.5rem 0.8rem"/>
                <Button 
                    icon={soundEnabled ? faVolumeUp : faVolumeMute} 
                    padding="0.5rem 0.8rem"
                    onClick={toggleSound}
                    variant={soundEnabled ? "primary" : "secondary"}
                />
            </motion.div>
            
            <SoundRenderer />
        </div>
    );
}