import "./styles.sass";
import {motion} from "framer-motion";

export const Background = () => {
    return (
        <div className="background-container">
            <motion.div className="circle-tl" animate={{left: ["-25rem", "-8rem"], top: ["-25rem", "-8rem"]}} />
            <motion.div className="rect-br" animate={{right: ["-25rem", "-9rem"], bottom: ["-25rem", "-5rem"]}} />
        </div>
    );
}