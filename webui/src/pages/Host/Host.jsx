import {useContext, useEffect} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate, useOutletContext} from "react-router-dom";
import "./styles.sass";
import QRCode from "qrcode.react";
import Triangle from "@/pages/Host/assets/Triangle.jsx";
import {BrandingContext} from "@/common/contexts/Branding";
import {motion} from "framer-motion";
import Button from "@/common/components/Button/index.js";
import {faGamepad, faUser, faVolumeMute} from "@fortawesome/free-solid-svg-icons";

export const Host = () => {
    const navigate = useNavigate();
    const {setCirclePosition} = useOutletContext();
    const {isLoaded, quizRaw} = useContext(QuizContext);
    const {titleImg} = useContext(BrandingContext);

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
        }
    }, [isLoaded]);

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    }, []);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className="host-page">

            <div className="quiz-info-container">
                <motion.div className="quiz-information" initial={{opacity: 0, y: -100}} animate={{opacity: 1, y: 0}}>
                    <div className="info-header">
                        <h1>“{quizRaw.title}”</h1>
                        <QRCode value={window.location.href} size={100} renderAs="svg" className="qr"/>
                    </div>

                    <p>Verbinden über die Webseite <span>www.bs2ab.quiz</span> mit Code:</p>
                    <h2>0000</h2>

                    <Triangle/>
                </motion.div>
                <Button text="Starten" icon={faGamepad} padding="0.5rem 1rem" onClick={() => navigate("/host/game")}/>
            </div>


            <motion.div className="member-info" initial={{opacity: 0, x: -100}} animate={{opacity: 1, x: 0}}>
                <img src={titleImg} alt="Quiz Logo" className="quiz-logo"/>
                <h2>Warten auf Mitspieler...</h2>
            </motion.div>


            <motion.div className="system-ui" initial={{opacity: 0, y: 100}} animate={{opacity: 1, y: 0}}>
                <Button icon={faUser} text="0" padding="0.5rem 0.8rem"/>
                <Button icon={faVolumeMute} padding="0.5rem 0.8rem"/>
            </motion.div>
        </div>
    );
}