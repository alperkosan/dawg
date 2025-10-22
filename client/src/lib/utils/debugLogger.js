/**
 * Debug Logger Utility
 *
 * Centralized logging system that can be disabled in production
 * for maximum performance.
 */

// Debug mode flag (set to false in production builds)
export const DEBUG_MODE = import.meta.env.DEV || false;

// Performance-critical paths should NEVER log
export const ALLOW_HOT_PATH_LOGGING = false;

/**
 * Log levels
 */
export const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

// Current log level (change based on environment)
let currentLogLevel = DEBUG_MODE ? LogLevel.DEBUG : LogLevel.WARN;

/**
 * Set log level
 */
export function setLogLevel(level) {
    currentLogLevel = level;
}

/**
 * Debug logger wrapper
 */
export const logger = {
    /**
     * Error logging (always enabled)
     */
    error(...args) {
        if (currentLogLevel >= LogLevel.ERROR) {
            console.error(...args);
        }
    },

    /**
     * Warning logging
     */
    warn(...args) {
        if (currentLogLevel >= LogLevel.WARN) {
            console.warn(...args);
        }
    },

    /**
     * Info logging (disabled in production)
     */
    info(...args) {
        if (currentLogLevel >= LogLevel.INFO) {
            console.log(...args);
        }
    },

    /**
     * Debug logging (only in dev mode)
     */
    debug(...args) {
        if (currentLogLevel >= LogLevel.DEBUG) {
            console.log(...args);
        }
    },

    /**
     * Trace logging (very verbose, only when explicitly enabled)
     */
    trace(...args) {
        if (currentLogLevel >= LogLevel.TRACE) {
            console.log(...args);
        }
    },

    /**
     * Performance-critical path logging
     * NEVER logs in production, even with DEBUG_MODE = true
     */
    hotPath(...args) {
        if (ALLOW_HOT_PATH_LOGGING) {
            console.log('[HOT PATH]', ...args);
        }
    }
};

/**
 * Measure performance of a function
 */
export function measurePerformance(name, fn) {
    if (!DEBUG_MODE) {
        return fn();
    }

    const start = performance.now();
    const result = fn();
    const end = performance.now();

    logger.debug(`⏱️ ${name}: ${(end - start).toFixed(4)}ms`);

    return result;
}

/**
 * Async performance measurement
 */
export async function measurePerformanceAsync(name, fn) {
    if (!DEBUG_MODE) {
        return await fn();
    }

    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    logger.debug(`⏱️ ${name}: ${(end - start).toFixed(4)}ms`);

    return result;
}

/**
 * Create a scoped logger with prefix
 */
export function createScopedLogger(scope) {
    return {
        error: (...args) => logger.error(`[${scope}]`, ...args),
        warn: (...args) => logger.warn(`[${scope}]`, ...args),
        info: (...args) => logger.info(`[${scope}]`, ...args),
        debug: (...args) => logger.debug(`[${scope}]`, ...args),
        trace: (...args) => logger.trace(`[${scope}]`, ...args),
        hotPath: (...args) => logger.hotPath(`[${scope}]`, ...args)
    };
}

// Global window access for debugging
if (typeof window !== 'undefined') {
    window.setAudioLogLevel = (level) => {
        setLogLevel(level);
        logger.info(`🔧 Log level set to: ${level}`);
    };

    window.enableHotPathLogging = () => {
        logger.warn('⚠️ Enabling hot path logging will SEVERELY impact performance!');
        // User can modify ALLOW_HOT_PATH_LOGGING manually if needed
    };
}

export default logger;
