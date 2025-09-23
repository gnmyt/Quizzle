import "./styles.sass";

export const TrueFalseClient = ({onSubmit}) => {
    return (
        <div className="true-false-client">
            <div className="true-false-option true-option" onClick={() => onSubmit([0])}>
                <span>Wahr</span>
            </div>
            <div className="true-false-option false-option" onClick={() => onSubmit([1])}>
                <span>Falsch</span>
            </div>
        </div>
    );
};