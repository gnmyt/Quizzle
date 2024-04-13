import {motion} from "framer-motion";
import "./styles.sass";

export const Answer = ({answer, index}) => {

    const getColorByIndex = (index) => {
        switch (index) {
            case 1:
                return "#6547EE";
            case 2:
                return "#1C945A";
            case 3:
                return "#EC5555";
            default:
                return "#FFA500";
        }
    }

    const getTextSize = (content) => {
        if (content.length <= 10) {
            return "3em";
        } else if (content.length <= 20) {
            return "2em";
        } else if (content.length <= 30) {
            return "1.5em";
        } else {
            return "1em";
        }
    }

    return (
        <>
            {answer.type === "text" && (
                <motion.div className="text-answer" style={{backgroundColor: getColorByIndex(index)}}
                            initial={{scale: 0}} animate={{scale: 1}} transition={{duration: 0.2,delay: index * 0.05}}>
                    <h2 style={{fontSize: getTextSize(answer.content)}}>{answer.content}</h2>
                </motion.div>
            )}
            {answer.type === "image" && (
                <motion.img src={answer.content} alt="Answer" className="image-answer"
                            initial={{scale: 0}} animate={{scale: 1}} transition={{duration: 0.2,delay: index * 0.05}}
                        style={{border: `5px solid ${getColorByIndex(index)}`}}/>
            )}
        </>
    )
}