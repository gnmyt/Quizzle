import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export const Button = ({icon, text, padding, onClick, type, disabled}) => {
    return (
        <button className={`btn btn-${type ? type : "default"}`} style={{padding: padding}} onClick={onClick}
                disabled={disabled}>
            {icon && <FontAwesomeIcon icon={icon}/>}
            {text}
        </button>
    )
}