import "./styles.sass";

export const Input = ({placeholder, onChange, value, textAlign}) => {
    return (
        <input className="custom-input" type="text" placeholder={placeholder} autoComplete="off"
               data-form-type="other" value={value} onChange={onChange} style={{textAlign: textAlign}}/>
    )
}