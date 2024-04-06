import "./styles.sass";
import {useEffect, useRef} from "react";

export const CodeWrapper = ({onChange, resetCode}) => {

    const blockInvalidChar = e => ['e', 'E', '+', '-', ".", ","].includes(e.key) && e.preventDefault();

    const codeWrapper = useRef(null);

    useEffect(() => {
        codeWrapper.current.childNodes.forEach(input => input.value = "");
        codeWrapper.current.childNodes[0].focus();
    }, [resetCode]);

    useEffect(() => {
        codeWrapper.current.addEventListener("keydown", (e) => {
            if (e.key !== "Backspace") return;

            codeWrapper.current.childNodes.forEach((input, index) => {
                if (e.target === input && index !== 0) codeWrapper.current.childNodes[index - 1].focus();
            });
        });
    }, []);

    const handleChange = (e) => {
        blockInvalidChar(e);
        codeWrapper.current.childNodes.forEach((input, index) => {
            if (e.target === input && e.target.value.length === 1 && index !== 3) {
                codeWrapper.current.childNodes[index + 1].focus();
            } else if (e.target === input && index === 3) {
                let code = "";
                codeWrapper.current.childNodes.forEach(input => code += input.value);
                onChange(code);
            }

            if (e.target.value.length > 1) e.target.value = e.target.value.slice(1);
        });
    }

    return (
        <div className="code-wrapper" ref={codeWrapper}>
            {[...Array(4)].map((_, index) => <input key={index} type="number" placeholder="0"
                                                    onKeyDown={blockInvalidChar}
                                                    onChange={handleChange}/>)}
        </div>
    )
}