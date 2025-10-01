import {useState, useContext} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChartBar} from "@fortawesome/free-solid-svg-icons";
import Dialog from "@/common/components/Dialog";
import Input from "@/common/components/Input";
import {postRequest} from "@/common/utils/RequestUtil.js";
import {BrandingContext} from "@/common/contexts/Branding";
import "./styles.sass";

export const ResultsDialog = ({isOpen, onClose, practiceCode, onSuccess}) => {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const {passwordProtected} = useContext(BrandingContext);

    const handleConfirm = async () => {
        if (passwordProtected && !password.trim()) {
            setError('Passwort ist erforderlich');
            return;
        }

        setIsLoading(true);
        try {
            const requestBody = passwordProtected ? {password} : {};
            await postRequest(`/practice/${practiceCode}/results`, requestBody);
            setPassword("");
            setError("");
            onClose();
            onSuccess(practiceCode, passwordProtected ? password : "");
        } catch (error) {
            console.error('Error validating password:', error);
            if (error.message && error.message.includes('401')) {
                setError('Ungültiges Passwort');
            } else if (error.message && error.message.includes('404')) {
                setError('Übungsquiz nicht gefunden');
            } else {
                setError('Fehler beim Validieren des Passworts');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setPassword("");
            setError("");
            onClose();
        }
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleConfirm}
            onCancel={handleClose}
            title={
                <div className="results-dialog-title">
                    <FontAwesomeIcon icon={faChartBar} className="results-dialog-title-icon"/>
                    Ergebnisse einsehen ({practiceCode})
                </div>
            }
            confirmText={isLoading ? "Wird validiert..." : "Ergebnisse anzeigen"}
            cancelText="Abbrechen"
            className="results-dialog"
        >
            <div className="results-dialog-content">
                {passwordProtected ? (
                    <>
                        <p className="results-dialog-text">
                            Bitte geben Sie das <strong>Lehrerpasswort</strong> ein, um die Ergebnisse einzusehen.
                        </p>

                        <div className="password-input-wrapper">
                            <Input
                                type="password"
                                placeholder="Passwort eingeben"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError("");
                                }}
                                error={error}
                                disabled={isLoading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isLoading) {
                                        handleConfirm();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    </>
                ) : (
                    <p className="results-dialog-text">
                        Möchten Sie die Ergebnisse für das Übungsquiz <strong>{practiceCode}</strong> einsehen?
                    </p>
                )}
            </div>
        </Dialog>
    );
};
