/**
 * Format Utilities
 * 
 * Helper functions for formatting various data types
 */

/**
 * Format file size in bytes to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB", "500 KB")
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @param {boolean} showMilliseconds - Whether to show milliseconds
 * @returns {string} Formatted duration (e.g., "3:45", "1:23.456")
 */
export function formatDuration(seconds, showMilliseconds = false) {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
        if (showMilliseconds) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
        }
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (showMilliseconds) {
        return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format sample rate to human-readable string
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {string} Formatted sample rate (e.g., "44.1 kHz", "48 kHz")
 */
export function formatSampleRate(sampleRate) {
    if (!sampleRate) return 'N/A';
    
    if (sampleRate >= 1000) {
        return `${(sampleRate / 1000).toFixed(1)} kHz`;
    }
    
    return `${sampleRate} Hz`;
}

/**
 * Format bit depth
 * @param {number} bitDepth - Bit depth
 * @returns {string} Formatted bit depth (e.g., "16-bit", "24-bit")
 */
export function formatBitDepth(bitDepth) {
    if (!bitDepth) return 'N/A';
    return `${bitDepth}-bit`;
}

/**
 * Format export format name
 * @param {string} format - Format code (e.g., "wav", "mp3")
 * @returns {string} Formatted format name (e.g., "WAV", "MP3")
 */
export function formatExportFormat(format) {
    if (!format) return 'N/A';
    return format.toUpperCase();
}

