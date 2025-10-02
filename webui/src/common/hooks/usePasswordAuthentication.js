import {useState, useContext} from 'react';
import {BrandingContext} from '../contexts/Branding';
import {AuthenticationUtil} from '../utils/AuthenticationUtil.js';
import toast from 'react-hot-toast';

export const usePasswordAuthentication = () => {
    const {passwordProtected} = useContext(BrandingContext);
    const [isAuthenticated, setIsAuthenticated] = useState(() => AuthenticationUtil.isAuthenticated());
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    const authenticate = async (password) => {
        try {
            const isValid = await AuthenticationUtil.authenticate(password);
            if (isValid) {
                setIsAuthenticated(true);
                setShowPasswordDialog(false);
                toast.success("Authentifizierung erfolgreich.");
                return true;
            } else {
                toast.error("Ungültiges Passwort.");
                return false;
            }
        } catch (error) {
            const errorMessage = error.message || "Ungültiges Passwort.";
            toast.error(errorMessage);
            console.error("Password validation error:", error);
            return false;
        }
    };

    const requireAuthentication = (action, actionName = null) => {
        if (passwordProtected && !isAuthenticated) {
            setShowPasswordDialog(true);
            setPendingAction({action, name: actionName});
        } else {
            action();
        }
    };

    const handlePasswordSubmit = async (password) => {
        const success = await authenticate(password);
        if (success && pendingAction) {
            pendingAction.action();
            setPendingAction(null);
        }
    };

    const closePasswordDialog = () => {
        setShowPasswordDialog(false);
        setPendingAction(null);
    };

    const logout = () => {
        AuthenticationUtil.clearPassword();
        setIsAuthenticated(false);
    };

    return {
        isAuthenticated, passwordProtected, showPasswordDialog, pendingAction,
        authenticate, requireAuthentication, handlePasswordSubmit, closePasswordDialog, logout,
        getAuthHeaders: AuthenticationUtil.getAuthHeaders,
        getAuthData: AuthenticationUtil.getAuthData
    };
};