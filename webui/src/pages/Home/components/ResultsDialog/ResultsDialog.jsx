import {useState, useContext, useEffect} from "react";
import PasswordDialog from "@/common/components/PasswordDialog";
import {postRequest} from "@/common/utils/RequestUtil.js";
import {BrandingContext} from "@/common/contexts/Branding";
import toast from "react-hot-toast";

export const ResultsDialog = ({isOpen, onClose, practiceCode, onSuccess}) => {
    const [isLoading, setIsLoading] = useState(false);
    const {passwordProtected} = useContext(BrandingContext);

    useEffect(() => {
        if (isOpen && !passwordProtected) {
            handleDirectAccess();
        }
    }, [isOpen, passwordProtected]);

    const handleDirectAccess = async () => {
        setIsLoading(true);
        try {
            await postRequest(`/practice/${practiceCode}/results`, {});
            onClose();
            onSuccess(practiceCode, "");
        } catch (error) {
            console.error('Error loading results:', error);
            if (error.message && error.message.includes('404')) {
                toast.error('Übungsquiz nicht gefunden');
            } else {
                toast.error('Fehler beim Laden der Ergebnisse');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (password) => {
        setIsLoading(true);
        try {
            await postRequest(`/practice/${practiceCode}/results`, {password});
            onClose();
            onSuccess(practiceCode, password);
        } catch (error) {
            console.error('Error validating password:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) onClose();
    };

    if (!passwordProtected) return null;

    return (
        <PasswordDialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handlePasswordSubmit}
        />
    );
};
