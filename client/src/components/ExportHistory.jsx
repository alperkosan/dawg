/**
 * 🎵 EXPORT HISTORY
 *
 * Component for displaying and managing export history
 * - View past exports
 * - Re-export with same settings
 * - Delete history items
 * - Load settings from history
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { History, Trash2, RefreshCw, Download, Clock, File, X } from 'lucide-react';
import { formatFileSize, formatDuration, formatExportFormat } from '@/utils/formatUtils';
import './ExportHistory.css';

const EXPORT_HISTORY_KEY = 'dawg_export_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Load export history from localStorage
 */
function loadExportHistory() {
    try {
        const stored = localStorage.getItem(EXPORT_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.warn('Failed to load export history:', error);
        return [];
    }
}

/**
 * Save export history to localStorage
 */
function saveExportHistory(history) {
    try {
        // Keep only last MAX_HISTORY_ITEMS
        const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
        console.warn('Failed to save export history:', error);
    }
}

/**
 * Add export to history
 */
export function addToExportHistory(exportData) {
    const history = loadExportHistory();
    const historyItem = {
        id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...exportData
    };
    
    // Add to beginning of array (most recent first)
    history.unshift(historyItem);
    saveExportHistory(history);
    
    return historyItem.id;
}

/**
 * Clear export history
 */
export function clearExportHistory() {
    try {
        localStorage.removeItem(EXPORT_HISTORY_KEY);
    } catch (error) {
        console.warn('Failed to clear export history:', error);
    }
}

export const ExportHistory = ({
    onReExport,
    onLoadSettings,
    onDelete,
    isOpen,
    onClose
}) => {
    const [history, setHistory] = useState(() => loadExportHistory());
    const [selectedItem, setSelectedItem] = useState(null);

    // Reload history when component opens
    useEffect(() => {
        if (isOpen) {
            setHistory(loadExportHistory());
        }
    }, [isOpen]);

    /**
     * Format timestamp to readable date
     */
    const formatTimestamp = useCallback((timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }, []);

    /**
     * Handle delete history item
     */
    const handleDelete = useCallback((itemId) => {
        const newHistory = history.filter(item => item.id !== itemId);
        setHistory(newHistory);
        saveExportHistory(newHistory);
        
        if (onDelete) {
            onDelete(itemId);
        }
    }, [history, onDelete]);

    /**
     * Handle clear all history
     */
    const handleClearAll = useCallback(() => {
        if (window.confirm('Are you sure you want to clear all export history?')) {
            setHistory([]);
            clearExportHistory();
        }
    }, []);

    /**
     * Handle re-export
     */
    const handleReExport = useCallback((item) => {
        if (onReExport) {
            onReExport(item);
        }
    }, [onReExport]);

    /**
     * Handle load settings
     */
    const handleLoadSettings = useCallback((item) => {
        if (onLoadSettings) {
            onLoadSettings(item.settings || {});
        }
    }, [onLoadSettings]);

    if (!isOpen) return null;

    return (
        <div className="export-history-overlay" onClick={onClose}>
            <div className="export-history-panel" onClick={(e) => e.stopPropagation()}>
                <div className="export-history-header">
                    <h3>
                        <History size={18} />
                        Export History
                    </h3>
                    <div className="export-history-actions">
                        {history.length > 0 && (
                            <button
                                className="export-history-clear-btn"
                                onClick={handleClearAll}
                                title="Clear all history"
                            >
                                Clear All
                            </button>
                        )}
                        <button
                            className="export-history-close-btn"
                            onClick={onClose}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="export-history-content">
                    {history.length === 0 ? (
                        <div className="export-history-empty">
                            <History size={48} />
                            <p>No export history</p>
                            <small>Your exports will appear here</small>
                        </div>
                    ) : (
                        <div className="export-history-list">
                            {history.map((item) => {
                                const file = item.file || item;
                                return (
                                    <div
                                        key={item.id}
                                        className={`export-history-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedItem(item)}
                                    >
                                        <div className="export-history-item-header">
                                            <div className="export-history-item-info">
                                                <span className="export-history-item-name">
                                                    {file.channelName || file.channelId || file.arrangementName || 'Export'}
                                                </span>
                                                <span className="export-history-item-time">
                                                    <Clock size={12} />
                                                    {formatTimestamp(item.timestamp)}
                                                </span>
                                            </div>
                                            <button
                                                className="export-history-item-delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(item.id);
                                                }}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {file.filename && (
                                            <div className="export-history-item-filename">
                                                <File size={12} />
                                                {file.filename}
                                            </div>
                                        )}

                                        <div className="export-history-item-metadata">
                                            {file.size && (
                                                <span className="metadata-badge">
                                                    {formatFileSize(file.size)}
                                                </span>
                                            )}
                                            {file.duration !== undefined && (
                                                <span className="metadata-badge">
                                                    {formatDuration(file.duration)}
                                                </span>
                                            )}
                                            {file.format && (
                                                <span className="metadata-badge">
                                                    {formatExportFormat(file.format)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="export-history-item-actions">
                                            <button
                                                className="export-history-action-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLoadSettings(item);
                                                }}
                                                title="Load settings"
                                            >
                                                <RefreshCw size={14} />
                                                Load Settings
                                            </button>
                                            <button
                                                className="export-history-action-btn primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReExport(item);
                                                }}
                                                title="Re-export"
                                            >
                                                <Download size={14} />
                                                Re-export
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExportHistory;






