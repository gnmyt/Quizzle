import {Outlet} from "react-router-dom";
import "./styles.sass";
import Background from "@/common/components/Background";
import {useEffect, useState} from "react";
import {Toaster} from "react-hot-toast";
import {socket} from "@/common/utils/SocketUtil.js";

export const Root = () => {
    const [circlePosition, setCirclePosition] = useState(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);

    useEffect(() => {
        socket.connect();

        return () => {
            socket.disconnect();
        }
    }, []);

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