import "./styles.sass";
import SelectBox from "@/common/components/SelectBox";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClock, faInfinity} from "@fortawesome/free-solid-svg-icons";
import {useState, useEffect} from "react";
import {motion} from "framer-motion";

export const QuestionSettings = ({question, onChange}) => {
    const [selectedTimer, setSelectedTimer] = useState(() => {
        if (question.timer === undefined || question.timer === null) return "default";
        if (question.timer === -1) return "unlimited";
        if (question.timer === 30) return "30";
        if (question.timer === 120) return "120";
        return "custom";
    });

    const timerOptions = [
        {
            value: "default",
            label: "Standard (60s)",
            description: "Standardzeit für Fragen",
            icon: faClock
        },
        {
            value: "30",
            label: "30 Sekunden",
            description: "Schnelle Fragen",
            icon: faClock
        },
        {
            value: "120",
            label: "2 Minuten",
            description: "Mehr Zeit zum Nachdenken",
            icon: faClock
        },
        {
            value: "unlimited",
            label: "Unbegrenzt",
            description: "Kein Zeitlimit",
            icon: faInfinity
        }
    ];

    useEffect(() => {
        if (question.timer === undefined || question.timer === null) {
            setSelectedTimer("default");
        } else if (question.timer === -1) {
            setSelectedTimer("unlimited");
        } else if (question.timer === 30) {
            setSelectedTimer("30");
        } else if (question.timer === 120) {
            setSelectedTimer("120");
        } else {
            setSelectedTimer("custom");
        }
    }, [question.timer]);

    const handleTimerChange = (value) => {
        setSelectedTimer(value);

        let timerNum;
        if (value === "default") {
            timerNum = undefined;
        } else if (value === "unlimited") {
            timerNum = -1;
        } else if (value === "30") {
            timerNum = 30;
        } else if (value === "120") {
            timerNum = 120;
        }

        onChange({...question, timer: timerNum});
    };

    if (!question) return null;

    return (
        <motion.div
            className="question-settings"
            initial={{opacity: 0, x: -20}}
            animate={{opacity: 1, x: 0}}
            transition={{duration: 0.25, delay: 0.2, ease: "easeOut"}}
        >
            <div className="settings-header">
                <h3>Fragen-Einstellungen</h3>
            </div>

            <div className="setting-group">
                <div className="setting-label">
                    <FontAwesomeIcon icon={faClock}/>
                    <span>Zeitlimit</span>
                </div>

                <SelectBox value={selectedTimer} onChange={handleTimerChange} options={timerOptions} placeholder="Timer auswählen..."/>
            </div>
        </motion.div>
    );
};