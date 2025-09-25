import React from 'react';
import Button from '../Button';
import './styles.sass';

const Dialog = ({
                    isOpen,
                    onClose,
                    title,
                    children,
                    onConfirm,
                    onCancel,
                    confirmText = "OK",
                    cancelText = "Abbrechen",
                    showCancelButton = true,
                    className = ""
                }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    };

    const handleConfirm = () => {
        onConfirm?.();
    };

    const handleCancel = () => {
        onCancel?.();
        onClose?.();
    };

    return (
        <div className="dialog-overlay" onClick={handleOverlayClick}>
            <div className={`dialog ${className}`}>
                {title && (
                    <div className="dialog-header">
                        <h3 className="dialog-title">{title}</h3>
                    </div>
                )}

                <div className="dialog-content">
                    {children}
                </div>

                {(showCancelButton || confirmText) && (
                    <div className="dialog-actions">
                        {showCancelButton && (
                            <Button
                                onClick={handleCancel}
                                type="secondary compact"
                                text={cancelText}
                            />
                        )}
                        {confirmText && (
                            <Button
                                onClick={handleConfirm}
                                type="primary compact"
                                text={confirmText}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dialog;
