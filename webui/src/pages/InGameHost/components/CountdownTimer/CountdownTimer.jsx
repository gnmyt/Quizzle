import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClock, faExclamationTriangle, faHourglassHalf} from "@fortawesome/free-solid-svg-icons";
import {useState, useEffect, useRef} from "react";
import {useSoundManager} from "@/common/utils/SoundManager.js";
import {motion, AnimatePresence} from "framer-motion";

export const CountdownTimer = ({duration, onTimeUp, isActive = true}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isWarning, setIsWarning] = useState(false);
    const [isCritical, setIsCritical] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const intervalRef = useRef(null);
    const soundManager = useSoundManager();
    const lastTickRef = useRef(null);

    useEffect(() => {
        setTimeLeft(duration);
        setIsWarning(false);
        setIsCritical(false);
        setIsVisible(true);
    }, [duration]);

    useEffect(() => {
        if (!isActive || duration <= 0) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setIsVisible(false);
            return;
        }

        intervalRef.current = setInterval(() => {
            setTimeLeft(prevTime => {
                const newTime = prevTime - 1;

                if (newTime <= 10 && newTime > 0) {
                    if (newTime !== lastTickRef.current) {
                        soundManager.playFeedback('TIMER_TICK');
                        lastTickRef.current = newTime;
                    }
                }
                
                if (newTime <= 30 && newTime > 10) {
                    setIsWarning(true);
                    setIsCritical(false);
                } else if (newTime <= 10 && newTime > 0) {
                    setIsWarning(false);
                    setIsCritical(true);
                } else {
                    setIsWarning(false);
                    setIsCritical(false);
                }
                
                if (newTime <= 0) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    soundManager.playFeedback('ANSWER_REVEALED');
                    setIsVisible(false);
                    onTimeUp();
                    return 0;
                }
                
                return newTime;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isActive, duration, onTimeUp, soundManager]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return secs.toString();
    };

    const getProgressPercentage = () => {
        return duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;
    };

    const getTimerIcon = () => {
        if (isCritical) return faExclamationTriangle;
        if (isWarning) return faHourglassHalf;
        return faClock;
    };

    const getTimerColor = () => {
        if (isCritical) return 'critical';
        if (isWarning) return 'warning';
        return 'normal';
    };

    if (duration <= 0 || !isVisible) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div 
                className={`countdown-timer ${getTimerColor()}`}
                initial={{ scale: 0, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: -20 }}
                transition={{ 
                    duration: 0.5, 
                    ease: "easeOut",
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                }}
            >
                <div className="timer-card">
                    <div className="timer-header">
                        <div className="timer-icon-container">
                            <FontAwesomeIcon icon={getTimerIcon()} className="timer-icon" />
                        </div>
                        <div className="timer-progress-container">
                            <div 
                                className="timer-progress-bar"
                                style={{ 
                                    width: `${getProgressPercentage()}%`,
                                    transition: 'width 0.5s ease-out'
                                }}
                            />
                        </div>
                    </div>
                    
                    <div className="timer-content">
                        <div className="timer-time">
                            {formatTime(timeLeft)}s
                        </div>
                        <div className="timer-label">
                            {isCritical ? 'Schnell!' : 'Zeit'}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};