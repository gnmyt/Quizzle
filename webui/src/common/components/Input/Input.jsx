import "./styles.sass";

export const Input = ({placeholder, onChange, value, textAlign, error, warning, maxLength, onBlur, disabled}) => {
    const handleChange = (e) => {
        const newValue = e.target.value;
        if (maxLength && newValue.length > maxLength) return;
        if (onChange) onChange(e);
    };

    const getClassName = () => {
        let className = "custom-input";
        if (error) className += " error";
        if (warning) className += " warning";
        if (disabled) className += " disabled";
        return className;
    };

    return (
        <div className="input-wrapper">
            <input
                className={getClassName()}
                type="text"
                placeholder={placeholder}
                autoComplete="off"
                data-form-type="other"
                value={value}
                onChange={handleChange}
                onBlur={onBlur}
                disabled={disabled}
                style={{textAlign: textAlign}}
                maxLength={maxLength}
            />
            {maxLength && (
                <div className="character-count">
                    {(value || "").length}/{maxLength}
                </div>
            )}
            {error && <div className="input-error">{error}</div>}
            {warning && !error && <div className="input-warning">{warning}</div>}
        </div>
    )
}