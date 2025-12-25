import React from 'react';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Global System Provider
// Wraps all context providers (Theme, Toast, DnD, future Auth/Project contexts)
export const SystemProvider = ({ children }) => {
    return (
        <DndProvider backend={HTML5Backend}>
            <ThemeProvider>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </ThemeProvider>
        </DndProvider>
    );
};
