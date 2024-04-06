import "./styles.sass";
import {motion} from "framer-motion";

export const Background = ({positionCircle}) => {
    return (
        <div className="background-container">
            <motion.div className="circle-tl" animate={{inset: positionCircle}}/>
            <motion.div className="rect-br" animate={{right: ["-25rem", "-9rem"], bottom: ["-25rem", "-9rem"]}}/>
        </div>
    );
}