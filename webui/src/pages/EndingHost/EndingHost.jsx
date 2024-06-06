import "./styles.sass";
import {useContext, useEffect} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate} from "react-router-dom";

export const EndingHost = () => {
    const {isLoaded} = useContext(QuizContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }
    }, []);

    return (
        <div className="ending-page">

        </div>
    )
}