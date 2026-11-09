import {Outlet, useNavigate, useLocation} from "react-router-dom";
import "./styles.sass";
import Background from "@/common/components/Background";
import {useContext, useEffect, useState} from "react";
import {Toaster} from "react-hot-toast";
import {socket, getSessionManager, restoreSession, addReconnectionCallback, removeReconnectionCallback} from "@/common/utils/SocketUtil.js";
import {AuthContext} from "@/common/contexts/Auth";
import LoginDialog from "@/common/components/LoginDialog";

export const Root = () => {
    const [circlePosition, setCirclePosition] = useState(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);
    const navigate = useNavigate();
    const location = useLocation();
    const {showLoginDialog, handleLoginSuccess, closeLoginDialog} = useContext(AuthContext);

    const isHostRoute = location.pathname.startsWith('/host');

    useEffect(() => {
        const handleRestored = (success, error, gameState) => {
            const params = new URLSearchParams(window.location.search);
            const requestedCode = params.get('code');
            const resumeLastRoom = requestedCode === null || requestedCode === String(gameState?.roomCode);
            if (success && window.location.pathname === '/' && resumeLastRoom) {
                navigate('/client', {replace: true});
            }
        };

        const handleResume = () => {
            if (document.visibilityState !== 'hidden' && getSessionManager().hasValidSession()) {
                restoreSession();
            }
        };

        addReconnectionCallback(handleRestored);
        document.addEventListener('visibilitychange', handleResume);
        window.addEventListener('pageshow', handleResume);
        window.addEventListener('online', handleResume);
        socket.connect();

        return () => {
            removeReconnectionCallback(handleRestored);
            document.removeEventListener('visibilitychange', handleResume);
            window.removeEventListener('pageshow', handleResume);
            window.removeEventListener('online', handleResume);
            socket.disconnect();
        }
    }, [navigate]);

    return (
        <>
            <a href="#main-content" className="skip-to-content">Zum Inhalt springen</a>
            <Background positionCircle={circlePosition} variant={isHostRoute ? 'host' : 'default'}/>
            <Toaster position="bottom-right" toastOptions={{duration: 4000}} />
            <LoginDialog
                isOpen={showLoginDialog}
                onClose={closeLoginDialog}
                onSuccess={handleLoginSuccess}
            />
            <main id="main-content" className={isHostRoute ? 'host-theme' : ''}>
                <Outlet context={{setCirclePosition}}/>
            </main>
        </>
    );
}
