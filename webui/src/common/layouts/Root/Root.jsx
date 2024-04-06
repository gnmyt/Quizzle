import {Outlet} from "react-router-dom";
import "./styles.sass";
import Background from "@/common/components/Background";
import {useState} from "react";
import {Toaster} from "react-hot-toast";

export const Root = () => {
    const [circlePosition, setCirclePosition] = useState(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    return (
        <>
            <Background positionCircle={circlePosition}/>
            <Toaster toastOptions={{position: "bottom-right"}} />
            <main>
                <Outlet context={{setCirclePosition}}/>
            </main>
        </>
    );
}