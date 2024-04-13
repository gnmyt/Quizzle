import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faForward, faUser} from "@fortawesome/free-solid-svg-icons";
import Button from "@/common/components/Button";

export const Scoreboard = ({scoreboard, nextQuestion}) => {
    return (
        <div className="scoreboard">
            <div className="top-area">
                <Button onClick={nextQuestion} text="Weiter"
                        padding="1rem 1.5rem" icon={faForward}/>
            </div>
            <h1>Scoreboard</h1>

            <div className="scoreboard-players">
                {scoreboard.sort((a, b) => b.points - a.points).map((player, index) => (
                    <div key={index} className="scoreboard-player">
                        <div className="player-info">
                            <FontAwesomeIcon icon={faUser}/>
                            <h2>{player.name}</h2>
                        </div>
                        <h2>{player.points}</h2>
                    </div>
                ))}
            </div>
        </div>
    )
}