import {useContext, useEffect} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate, useOutletContext} from "react-router-dom";

export const Host = () => {
    const navigate = useNavigate();
    const {setCirclePosition} = useOutletContext();
    const {isLoaded} = useContext(QuizContext);

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
        }
    }, [isLoaded]);

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    }, []);

    return (
        <div className="host-page">
            <h1>Host2</h1>
        </div>
    );
}