import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faForward, faHouse, faUser} from "@fortawesome/free-solid-svg-icons";
import Button from "@/common/components/Button";
import {useNavigate} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";
import {getCharacterEmoji} from "@/common/data/characters";

export const Scoreboard = ({scoreboard, nextQuestion, isEnd}) => {
    const goHome = () => {
        location.reload();
    }
    return (
        <div className="scoreboard">
            <div className="top-area">
                {!isEnd && <Button onClick={nextQuestion} text="Weiter"
                        padding="1rem 1.5rem" icon={faForward}/>}
                {isEnd && <Button onClick={goHome} text="Startseite"
                        padding="1rem 1.5rem" icon={faHouse}/>}
            </div>
            <h1>{isEnd ? "Endstand" : "Scoreboard"}</h1>

            <div className="scoreboard-players">
                {scoreboard.sort((a, b) => b.points - a.points).map((player, index) => (
                    <div key={index} className="scoreboard-player">
                        <div className="player-info">
                            <div className="player-character">
                                {getCharacterEmoji(player.character)}
                            </div>
                            <h2>{player.name}</h2>
                        </div>
                        <h2>{player.points}</h2>
                    </div>
                ))}
            </div>
        </div>
    )
}