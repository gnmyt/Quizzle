import {motion, AnimatePresence} from "framer-motion";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBullseye} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";

export const DoublePointsAnimation = ({isVisible, onComplete}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div className="double-points-overlay" initial={{opacity: 0}} animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: 0.5}}
                            onAnimationComplete={(definition) => {
                                if (definition === 1) {
                                    setTimeout(() => {
                                        onComplete?.();
                                    }, 2000);
                                }
                            }}>
                    <motion.div className="double-points-content" initial={{scale: 0.5, y: 50}}
                                animate={{scale: 1, y: 0}}
                                transition={{
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 15,
                                    delay: 0.2
                                }}>
                        <motion.div className="double-points-icon" initial={{opacity: 0, y: 20}}
                                    animate={{opacity: 1, y: 0}} transition={{delay: 0.3, duration: 0.6}}>
                            <FontAwesomeIcon icon={faBullseye}/>
                        </motion.div>
                        <motion.h1 className="double-points-title" initial={{opacity: 0, y: 20}}
                                   animate={{opacity: 1, y: 0}} transition={{delay: 0.5, duration: 0.6}}>
                            Doppelte Punkte!
                        </motion.h1>
                        <motion.p className="double-points-subtitle" initial={{opacity: 0, y: 20}}
                                  animate={{opacity: 1, y: 0}} transition={{delay: 0.8, duration: 0.6}}>
                            Diese Frage bringt die doppelte Punktzahl!
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};