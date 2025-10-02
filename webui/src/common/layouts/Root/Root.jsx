import {Outlet, useNavigate} from "react-router-dom";
import "./styles.sass";
import Background from "@/common/components/Background";
import {useEffect, useState} from "react";
import {Toaster} from "react-hot-toast";
import {socket, getSessionManager, getSessionState} from "@/common/utils/SocketUtil.js";

export const Root = () => {
    const [circlePosition, setCirclePosition] = useState(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    const navigate = useNavigate();

    useEffect(() => {
        socket.connect();

        const sessionManager = getSessionManager();
        if (sessionManager.hasValidSession()) {
            const currentPath = window.location.pathname;
            
            if (currentPath === '/') {
                const validateAndRedirect = () => {
                    if (socket.connected) {
                        getSessionState().then(sessionState => {
                            if (sessionState && sessionState.roomCode) {
                                navigate('/client');
                            } else {
                                sessionManager.clearSession();
                            }
                        });
                    } else {
                        setTimeout(() => {
                            if (socket.connected) {
                                validateAndRedirect();
                            }
                        }, 2000);
                    }
                };
                setTimeout(validateAndRedirect, 100);
            }
        }

        return () => {
            socket.disconnect();
        }
    }, [navigate]);

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