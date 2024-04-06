import {BrandingContext} from "@/common/contexts/Branding";
import {useContext} from "react";
import "./styles.sass";
import {motion} from "framer-motion";

export const Home = () => {
    const {titleImg} = useContext(BrandingContext);

    return (
        <div className="home-page">
            <motion.img src={titleImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}  />

            <motion.div initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}} transition={{delay: 0.5}}>

            </motion.div>
        </div>
    )
}