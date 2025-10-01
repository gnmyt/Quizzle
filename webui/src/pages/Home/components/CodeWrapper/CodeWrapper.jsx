import "./styles.sass";
import {useEffect, useRef} from "react";

export const CodeWrapper = ({onChange, resetCode, errorClass}) => {

    const blockInvalidChar = e => ['e', 'E', '+', '-', ".", ","].includes(e.key) && e.preventDefault();

    const codeWrapper = useRef(null);

    useEffect(() => {
        codeWrapper.current.childNodes.forEach(input => input.value = "");
        codeWrapper.current.childNodes[0].focus();
    }, [resetCode]);

    const handleKeyDown = (e) => {
        const inputs = Array.from(codeWrapper.current.childNodes);
        const currentIndex = inputs.indexOf(e.target);

        if (e.key === "Backspace") {
            e.preventDefault();

            if (e.target.value !== "") {
                e.target.value = "";
            } else if (currentIndex > 0) {
                const prevInput = inputs[currentIndex - 1];
                prevInput.focus();
                prevInput.value = "";
            }

            const code = inputs.map(input => input.value).join("");
            if (code.length === 4) {
                onChange(code);
            }
        } else if (e.key === "ArrowLeft" && currentIndex > 0) {
            e.preventDefault();
            inputs[currentIndex - 1].focus();
        } else if (e.key === "ArrowRight" && currentIndex < inputs.length - 1) {
            e.preventDefault();
            inputs[currentIndex + 1].focus();
        } else if (e.key.match(/^[a-z0-9]$/i)) {
            if (e.target.value !== "") {
                e.target.value = "";
            }
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const validChars = pastedData.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();

        if (validChars.length > 0) {
            const inputs = Array.from(codeWrapper.current.childNodes);

            for (let i = 0; i < 4; i++) {
                inputs[i].value = validChars[i] || "";
            }

            const nextEmptyIndex = validChars.length < 4 ? validChars.length : 3;
            inputs[nextEmptyIndex].focus();

            if (validChars.length === 4) {
                onChange(validChars);
            }
        }
    };

    const handleInput = (e) => {
        const inputs = Array.from(codeWrapper.current.childNodes);
        const currentIndex = inputs.indexOf(e.target);
        const inputValue = e.target.value;

        if (inputValue.length > 1) {
            const validChars = inputValue.replace(/[^a-z0-9]/gi, '').toUpperCase();
            e.target.value = validChars[0] || "";

            for (let i = 1; i < validChars.length && currentIndex + i < 4; i++) {
                inputs[currentIndex + i].value = validChars[i];
            }

            const nextIndex = Math.min(currentIndex + validChars.length, 3);
            inputs[nextIndex].focus();

            const code = inputs.map(input => input.value).join("");
            if (code.length === 4) {
                onChange(code);
            }
        } else if (inputValue.length === 1) {
            const char = inputValue.replace(/[^a-z0-9]/gi, '').toUpperCase();
            e.target.value = char;

            if (currentIndex < 3 && char) {
                inputs[currentIndex + 1].focus();
            }

            const code = inputs.map(input => input.value).join("");
            if (code.length === 4) {
                onChange(code);
            }
        }
    };

    const handleFocus = (e) => {
        e.target.select();
    };

    return (
        <div className={"code-wrapper" + (errorClass ? " " + errorClass : "")} ref={codeWrapper}>
            {[...Array(4)].map((_, index) =>
                <input
                    key={index}
                    type="text"
                    inputMode="text"
                    maxLength="4"
                    placeholder="0"
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onFocus={handleFocus}
                    autoComplete="off"
                    style={{textTransform: 'uppercase'}}
                />
            )}
        </div>
    )
}