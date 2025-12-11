import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { ToastContainer } from '../components/common/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [toastKey, setToastKey] = useState(0);

    const showToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, duration };
        // Serialize to ensure clean object
        const serializedToast = JSON.parse(JSON.stringify(toast));

        // Defer flushSync to avoid lifecycle conflicts
        queueMicrotask(() => {
            try {
                flushSync(() => {
                    setToasts(prev => [...prev, serializedToast]);
                    setToastKey(prev => prev + 1);
                });
            } catch (error) {
                // Fallback if flushSync fails
                setToasts(prev => [...prev, serializedToast]);
                setToastKey(prev => prev + 1);
            }
        });

        // Auto-remove
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Sync with API service for global error handling
    useEffect(() => {
        import('../services/api.js').then(({ setToastHandler }) => {
            setToastHandler(showToast);
        });
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} key={toastKey} />
        </ToastContext.Provider>
    );
};
