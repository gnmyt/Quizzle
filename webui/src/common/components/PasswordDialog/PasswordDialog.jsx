import React, {useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faShieldAlt} from '@fortawesome/free-solid-svg-icons';
import Dialog from '@/common/components/Dialog';
import Input from '@/common/components/Input';
import './PasswordDialog.sass';

export const PasswordDialog = ({isOpen, onClose, onConfirm}) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleConfirm = () => {
        if (!password.trim()) {
            setError('Passwort ist erforderlich');
            return;
        }

        onConfirm(password);
        setPassword('');
        setError('');
    };

    const handleClose = () => {
        setPassword('');
        setError('');
        onClose();
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            onConfirm={handleConfirm}
            onCancel={handleClose}
            title={
                <div className="password-dialog-title">
                    <FontAwesomeIcon icon={faShieldAlt} className="password-dialog-title-icon"/>
                    Lehrerpasswort erforderlich
                </div>
            }
            confirmText="Anmelden"
            cancelText="Abbrechen"
            className="password-dialog"
        >
            <div className="password-dialog-content">
                <p className="password-dialog-text">
                    Bitte geben Sie das <strong>Lehrerpasswort</strong> ein.
                </p>
                <div className="password-input-wrapper">
                    <Input
                        type="password"
                        placeholder="Passwort eingeben"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={error}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleConfirm();
                            }
                        }}
                    />
                </div>
            </div>
        </Dialog>
    );
};