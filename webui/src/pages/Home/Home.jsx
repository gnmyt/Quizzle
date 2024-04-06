import {BrandingContext} from "@/common/contexts/Branding";
import {useContext, useEffect} from "react";
import "./styles.sass";
import {motion} from "framer-motion";
import CodeWrapper from "@/pages/Home/components/CodeWrapper";
import Button from "@/common/components/Button/index.js";
import {faQrcode, faShareFromSquare, faSwatchbook} from "@fortawesome/free-solid-svg-icons";
import {useNavigate, useOutletContext} from "react-router-dom";

export const Home = () => {
    const {titleImg} = useContext(BrandingContext);
    const {setCirclePosition} = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    }, []);

    return (
        <div className="home-page">
            <motion.img src={titleImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}/>

            <motion.div initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}} transition={{delay: 0.5}}
                        className="home-content">
                <div className="join-area">
                    <h2>Code eingeben</h2>
                    <CodeWrapper/>

                    <div className="alternative">
                        <hr/>
                        <h2>oder</h2>
                        <hr/>
                    </div>

                    <Button text="Code Scannen" icon={faQrcode} padding={"0.7rem 1.5rem"}/>
                </div>
                <div className="action-area">
                    <Button text="Quiz erstellen" icon={faSwatchbook} padding={"0.8rem 2.5rem"}
                            onClick={() => {
                                setCirclePosition("-25rem 0 0 -25rem");
                                setTimeout(() => navigate("/create"), 500);
                            }}/>
                    <Button text="Raum hosten" icon={faShareFromSquare} padding={"0.8rem 2.5rem"}/>
                </div>
            </motion.div>
        </div>
    )
}