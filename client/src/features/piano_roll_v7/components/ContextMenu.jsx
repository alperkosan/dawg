/**
 * PIANO ROLL CONTEXT MENU
 *
 * Professional DAW-style right-click context menu
 * Provides quick access to note operations
 */

import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

const ContextMenu = ({
    x,
    y,
    noteId,
    hasSelection,
    canUndo,
    canRedo,
    onClose,
    onCut,
    onCopy,
    onPaste,
    onDelete,
    onDuplicate,
    onGlue,
    onSplit,
    onQuantize,
    onHumanize,
    onVelocityFadeIn,
    onVelocityFadeOut,
    onVelocityNormalize
}) => {
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Position menu to keep it on screen
    useEffect(() => {
        if (!menuRef.current) return;

        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        let adjustedY = y;

        // Keep menu within viewport horizontally
        if (x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 10;
        }

        // Keep menu within viewport vertically
        if (y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 10;
        }

        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
    }, [x, y]);

    const handleAction = (action, requiresSelection = false) => {
        if (requiresSelection && !hasSelection && !noteId) {
            console.warn('Action requires selection');
            return;
        }
        action?.();
        onClose();
    };

    return (
        <div ref={menuRef} className="piano-roll-context-menu">
            {/* Basic Operations */}
            <div
                className="context-menu-item"
                onClick={() => handleAction(onCut, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Cut</span>
                <span className="menu-shortcut">Ctrl+X</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onCopy, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Copy</span>
                <span className="menu-shortcut">Ctrl+C</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onPaste)}
            >
                <span className="menu-label">Paste</span>
                <span className="menu-shortcut">Ctrl+V</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onDelete, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Delete</span>
                <span className="menu-shortcut">Del</span>
            </div>

            <div className="context-menu-separator" />

            {/* Note Operations */}
            <div
                className="context-menu-item"
                onClick={() => handleAction(onDuplicate, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Duplicate</span>
                <span className="menu-shortcut">Ctrl+D</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onGlue, true)}
                disabled={!hasSelection}
            >
                <span className="menu-label">Glue Notes</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onSplit, true)}
                disabled={!noteId}
            >
                <span className="menu-label">Split Note</span>
            </div>

            <div className="context-menu-separator" />

            {/* Advanced Operations */}
            <div
                className="context-menu-item"
                onClick={() => handleAction(onQuantize, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Quantize</span>
            </div>
            <div
                className="context-menu-item"
                onClick={() => handleAction(onHumanize, true)}
                disabled={!hasSelection && !noteId}
            >
                <span className="menu-label">Humanize</span>
            </div>

            {/* Velocity Submenu */}
            <div className="context-menu-item context-menu-submenu">
                <span className="menu-label">Velocity</span>
                <span className="menu-arrow">▶</span>
                <div className="context-menu-submenu-content">
                    <div
                        className="context-menu-item"
                        onClick={() => handleAction(onVelocityFadeIn, true)}
                        disabled={!hasSelection}
                    >
                        <span className="menu-label">Fade In</span>
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => handleAction(onVelocityFadeOut, true)}
                        disabled={!hasSelection}
                    >
                        <span className="menu-label">Fade Out</span>
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => handleAction(onVelocityNormalize, true)}
                        disabled={!hasSelection}
                    >
                        <span className="menu-label">Normalize</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContextMenu;
