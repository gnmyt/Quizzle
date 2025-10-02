import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    className="dialog-overlay" 
                    onClick={handleOverlayClick}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div 
                        className={`dialog ${className}`}
                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                    >
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
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Dialog;
