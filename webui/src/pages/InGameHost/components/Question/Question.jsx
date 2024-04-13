import "./styles.sass";
import {motion} from "framer-motion";

export const Question = ({title, image}) => {
    return (
        <>
            {!image && <motion.div className="question-container" initial={{y: 100}} animate={{y: 0}}
                                   style={{marginTop: "15rem"}}>
                <div className="question-circle"/>
                <div className="question">
                    <h1>{title}</h1>
                </div>
            </motion.div>}
            {image && <motion.div className="image-question-container" initial={{y: 100}} animate={{y: 0}}
                                  style={{marginTop: "10rem"}}>
                <div className="image-question">
                    <h1>{title}</h1>
                </div>
                <img src={image} alt={title} />
            </motion.div>}
        </>
    );
}