import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";

export const AddQuestion = ({onClick}) => {
    return (
        <div className="add-question" onClick={onClick}>
            <FontAwesomeIcon icon={faPlus} />
        </div>
    )
}