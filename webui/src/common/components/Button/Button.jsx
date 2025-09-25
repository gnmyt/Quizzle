import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export const Button = ({icon, text, padding, onClick, type, disabled}) => {
    const types = type ? type.split(' ') : ['default'];
    const typeClasses = types.map(t => `btn-${t}`).join(' ');
    
    return (
        <button className={`btn ${typeClasses}`} style={{padding: padding}} onClick={onClick}
                disabled={disabled}>
            {icon && <FontAwesomeIcon icon={icon}/>}
            {text}
        </button>
    )
}