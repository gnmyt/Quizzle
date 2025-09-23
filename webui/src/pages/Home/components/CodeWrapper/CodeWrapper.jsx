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
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const digits = pastedData.replace(/\D/g, '').slice(0, 4);

        if (digits.length > 0) {
            const inputs = Array.from(codeWrapper.current.childNodes);

            for (let i = 0; i < 4; i++) {
                inputs[i].value = digits[i] || "";
            }

            const nextEmptyIndex = digits.length < 4 ? digits.length : 3;
            inputs[nextEmptyIndex].focus();

            if (digits.length === 4) {
                onChange(digits);
            }
        }
    };

    const handleInput = (e) => {
        const inputs = Array.from(codeWrapper.current.childNodes);
        const currentIndex = inputs.indexOf(e.target);

        if (e.target.value.length > 1) {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
            e.target.value = digits[0] || "";

            for (let i = 1; i < digits.length && currentIndex + i < 4; i++) {
                inputs[currentIndex + i].value = digits[i];
            }

            const nextIndex = Math.min(currentIndex + digits.length, 3);
            inputs[nextIndex].focus();

            const code = inputs.map(input => input.value).join("");
            if (code.length === 4) {
                onChange(code);
            }
        } else if (e.target.value.length === 1) {
            if (currentIndex < 3) {
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
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="4"
                    placeholder="0"
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onFocus={handleFocus}
                    autoComplete="off"
                />
            )}
        </div>
    )
}