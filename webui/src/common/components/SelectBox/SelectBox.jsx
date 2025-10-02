import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown} from "@fortawesome/free-solid-svg-icons";
import {useState, useRef, useEffect} from "react";
import {motion, AnimatePresence} from "framer-motion";

export const SelectBox = ({value, onChange, options, placeholder = "Auswählen...", disabled = false}) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const getSelectedOption = () => {
        return options.find(option => option.value === value);
    };

    const handleOptionClick = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const selectedOption = getSelectedOption();

    return (
        <div className={`select-box ${disabled ? 'disabled' : ''}`} ref={selectRef}>
            <div
                className={`select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="select-content">
                    {selectedOption ? (
                        <div className="selected-option">
                            {selectedOption.icon && (
                                <FontAwesomeIcon icon={selectedOption.icon} className="option-icon"/>
                            )}
                            <span className="option-label">{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span className="placeholder">{placeholder}</span>
                    )}
                </div>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`select-arrow ${isOpen ? 'rotated' : ''}`}
                />
            </div>

            <AnimatePresence>
                {isOpen && !disabled && (
                    <motion.div
                        className="select-dropdown"
                        initial={{opacity: 0, y: -10, scale: 0.95}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: -10, scale: 0.95}}
                        transition={{duration: 0.2}}
                    >
                        {options.map((option) => (
                            <div
                                key={option.value}
                                className={`select-option ${value === option.value ? 'selected' : ''}`}
                                onClick={() => handleOptionClick(option.value)}
                            >
                                {option.icon && (
                                    <FontAwesomeIcon icon={option.icon} className="option-icon"/>
                                )}
                                <div className="option-content">
                                    <span className="option-label">{option.label}</span>
                                    {option.description && (
                                        <span className="option-description">{option.description}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};