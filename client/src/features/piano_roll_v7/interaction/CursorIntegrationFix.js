/**
 * Cursor Integration Fix - Piano Roll Cursor System Integration
 * 
 * Bu dosya, piano roll'da cursor sistemlerinin entegrasyonunu düzeltir.
 * Çakışan cursor sistemlerini tek bir merkezi sistemde birleştirir.
 */

// ✅ Browser-compatible EventEmitter
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    off(event, listener) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }

    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
}

// ✅ CURSOR INTEGRATION CONSTANTS
export const CURSOR_INTEGRATION_MODES = {
    CSS_ONLY: 'css-only',           // Sadece CSS data-cursor kullan
    PREMIUM_ONLY: 'premium-only',   // Sadece premium cursor system kullan
    HYBRID: 'hybrid',               // CSS + Premium hybrid
    UNIFIED: 'unified'              // Tamamen birleşik sistem
};

export const CURSOR_PRIORITY_LEVELS = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
    EMERGENCY: 5
};

/**
 * Cursor Integration Fix
 * 
 * Bu sınıf, piano roll'da cursor sistemlerinin entegrasyonunu düzeltir.
 * Çakışan cursor sistemlerini tek bir merkezi sistemde birleştirir.
 */
export class CursorIntegrationFix extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Integration mode
            mode: CURSOR_INTEGRATION_MODES.UNIFIED,
            
            // Piano roll element targeting
            pianoRollSelector: '.prv5-canvas-container',
            pianoRollElement: null,
            
            // Cursor system priority
            priority: {
                premium: CURSOR_PRIORITY_LEVELS.HIGH,
                css: CURSOR_PRIORITY_LEVELS.MEDIUM,
                direct: CURSOR_PRIORITY_LEVELS.LOW
            },
            
            // Conflict resolution
            conflictResolution: {
                enabled: true,
                logConflicts: true,
                autoResolve: true,
                fallbackToCSS: true
            },
            
            // Performance settings
            performance: {
                debounceMs: 16,
                throttleMs: 8,
                maxUpdatesPerSecond: 60,
                enableCaching: true
            },
            
            // Debug settings
            debug: {
                enabled: false,
                logCursorChanges: false,
                logConflicts: true,
                logPerformance: false
            },
            
            ...options
        };
        
        // State management
        this.state = {
            // Current cursor
            current: null,
            previous: null,
            source: null, // 'premium', 'css', 'direct'
            
            // Piano roll element
            pianoRollElement: null,
            
            // Conflict tracking
            conflicts: [],
            lastConflict: null,
            
            // Performance tracking
            updateCount: 0,
            lastUpdate: 0,
            averageUpdateTime: 0,
            
            // Cursor cache
            cursorCache: new Map(),
            
            // Event listeners
            listeners: new Map()
        };
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the cursor integration fix
     */
    initialize() {
        this.findPianoRollElement();
        this.setupEventListeners();
        this.setupConflictResolution();
        this.setupPerformanceMonitoring();
        
        console.log('🔧 Cursor Integration Fix initialized');
    }
    
    /**
     * Find piano roll element
     */
    findPianoRollElement() {
        // Try to find piano roll element
        const element = document.querySelector(this.config.pianoRollSelector);
        if (element) {
            this.state.pianoRollElement = element;
            this.config.pianoRollElement = element;
            console.log('🎹 Piano roll element found:', element);
        } else {
            console.warn('⚠️ Piano roll element not found, will retry...');
            // Retry after a short delay
            setTimeout(() => this.findPianoRollElement(), 100);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for cursor changes from different sources
        this.on('cursorChange', this.handleCursorChange.bind(this));
        this.on('cursorConflict', this.handleCursorConflict.bind(this));
        
        // Listen for DOM changes
        this.setupDOMObserver();
        
        // Listen for style changes
        this.setupStyleObserver();
    }
    
    /**
     * Setup DOM observer
     */
    setupDOMObserver() {
        if (!this.state.pianoRollElement) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'data-cursor' || 
                     mutation.attributeName === 'style')) {
                    this.handleDOMChange(mutation);
                }
            });
        });
        
        observer.observe(this.state.pianoRollElement, {
            attributes: true,
            attributeFilter: ['data-cursor', 'style']
        });
        
        this.state.listeners.set('domObserver', observer);
    }
    
    /**
     * Setup style observer
     */
    setupStyleObserver() {
        if (!this.state.pianoRollElement) return;
        
        // Monitor style changes
        const checkStyleChanges = () => {
            const currentStyle = this.state.pianoRollElement.style.cursor;
            if (currentStyle !== this.state.current?.style) {
                this.handleStyleChange(currentStyle);
            }
        };
        
        const interval = setInterval(checkStyleChanges, 100);
        this.state.listeners.set('styleObserver', interval);
    }
    
    /**
     * Setup conflict resolution
     */
    setupConflictResolution() {
        if (!this.config.conflictResolution.enabled) return;
        
        // Monitor for conflicts
        this.on('cursorConflict', (conflict) => {
            if (this.config.conflictResolution.autoResolve) {
                this.resolveConflict(conflict);
            }
        });
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        if (!this.config.debug.logPerformance) return;
        
        const monitor = () => {
            const now = performance.now();
            const deltaTime = now - this.state.lastUpdate;
            
            this.state.updateCount++;
            this.state.averageUpdateTime = 
                (this.state.averageUpdateTime * 0.9) + (deltaTime * 0.1);
            
            this.state.lastUpdate = now;
            
            if (this.config.debug.logPerformance) {
                console.log('📊 Cursor Performance:', {
                    updateCount: this.state.updateCount,
                    averageUpdateTime: this.state.averageUpdateTime.toFixed(2) + 'ms',
                    conflicts: this.state.conflicts.length
                });
            }
        };
        
        const interval = setInterval(monitor, 1000);
        this.state.listeners.set('performanceMonitor', interval);
    }
    
    /**
     * Handle cursor change
     */
    handleCursorChange(data) {
        const { cursor, source, priority } = data;
        
        // Check for conflicts
        if (this.state.current && this.state.current.source !== source) {
            this.handleCursorConflict({
                current: this.state.current,
                incoming: { cursor, source, priority },
                timestamp: Date.now()
            });
        }
        
        // Update state
        this.state.previous = this.state.current;
        this.state.current = { cursor, source, priority, timestamp: Date.now() };
        
        // Apply cursor based on integration mode
        this.applyCursor(cursor, source, priority);
        
        // Emit change event
        this.emit('cursorApplied', {
            cursor,
            source,
            priority,
            previous: this.state.previous
        });
    }
    
    /**
     * Handle cursor conflict
     */
    handleCursorConflict(conflict) {
        this.state.conflicts.push(conflict);
        this.state.lastConflict = conflict;
        
        if (this.config.debug.logConflicts) {
            console.warn('⚠️ Cursor conflict detected:', conflict);
        }
        
        this.emit('cursorConflict', conflict);
    }
    
    /**
     * Handle performance update
     */
    handlePerformanceUpdate(data) {
        if (this.config.debug.logPerformance) {
            console.log('📊 Cursor Performance Update:', data);
        }
    }
    
    /**
     * Resolve cursor conflict
     */
    resolveConflict(conflict) {
        const { current, incoming } = conflict;
        
        // Resolve based on priority
        if (incoming.priority > current.priority) {
            this.applyCursor(incoming.cursor, incoming.source, incoming.priority);
            console.log('✅ Conflict resolved: Incoming cursor has higher priority');
        } else if (incoming.priority === current.priority) {
            // Same priority, use timestamp (newer wins)
            if (incoming.timestamp > current.timestamp) {
                this.applyCursor(incoming.cursor, incoming.source, incoming.priority);
                console.log('✅ Conflict resolved: Incoming cursor is newer');
            }
        } else {
            console.log('✅ Conflict resolved: Current cursor has higher priority');
        }
    }
    
    /**
     * Handle DOM change
     */
    handleDOMChange(mutation) {
        const { attributeName, target } = mutation;
        
        if (attributeName === 'data-cursor') {
            const cursor = target.getAttribute('data-cursor');
            this.handleCursorChange({
                cursor,
                source: 'css',
                priority: this.config.priority.css
            });
        }
    }
    
    /**
     * Handle style change
     */
    handleStyleChange(style) {
        if (style && style.includes('cursor:')) {
            const cursor = style.split('cursor:')[1]?.split(';')[0]?.trim();
            if (cursor) {
                this.handleCursorChange({
                    cursor,
                    source: 'direct',
                    priority: this.config.priority.direct
                });
            }
        }
    }
    
    /**
     * Apply cursor based on integration mode
     */
    applyCursor(cursor, source, priority) {
        if (!this.state.pianoRollElement) {
            console.warn('⚠️ Piano roll element not found, cannot apply cursor');
            return;
        }
        
        switch (this.config.mode) {
            case CURSOR_INTEGRATION_MODES.CSS_ONLY:
                this.applyCSSCursor(cursor);
                break;
            case CURSOR_INTEGRATION_MODES.PREMIUM_ONLY:
                this.applyPremiumCursor(cursor, source, priority);
                break;
            case CURSOR_INTEGRATION_MODES.HYBRID:
                this.applyHybridCursor(cursor, source, priority);
                break;
            case CURSOR_INTEGRATION_MODES.UNIFIED:
                this.applyUnifiedCursor(cursor, source, priority);
                break;
        }
    }
    
    /**
     * Apply CSS cursor
     */
    applyCSSCursor(cursor) {
        // Remove all cursor classes
        this.state.pianoRollElement.classList.remove(
            'premium-cursor', 'custom-cursor', 'cursor-animated'
        );
        
        // Set data-cursor attribute
        this.state.pianoRollElement.setAttribute('data-cursor', cursor);
        
        // Clear direct style
        this.state.pianoRollElement.style.cursor = '';
    }
    
    /**
     * Apply premium cursor
     */
    applyPremiumCursor(cursor, source, priority) {
        // Remove CSS cursor
        this.state.pianoRollElement.removeAttribute('data-cursor');
        
        // Clear direct style
        this.state.pianoRollElement.style.cursor = '';
        
        // Apply premium cursor classes
        this.state.pianoRollElement.classList.add('premium-cursor', cursor);
        
        // Set CSS cursor for fallback
        this.state.pianoRollElement.style.cursor = this.getCSSFallback(cursor);
    }
    
    /**
     * Apply hybrid cursor
     */
    applyHybridCursor(cursor, source, priority) {
        if (source === 'premium') {
            this.applyPremiumCursor(cursor, source, priority);
        } else {
            this.applyCSSCursor(cursor);
        }
    }
    
    /**
     * Apply unified cursor
     */
    applyUnifiedCursor(cursor, source, priority) {
        // Remove all existing cursor styles
        this.clearAllCursors();
        
        // Apply based on source and priority
        if (source === 'premium' && priority >= this.config.priority.premium) {
            this.applyPremiumCursor(cursor, source, priority);
        } else if (source === 'css' && priority >= this.config.priority.css) {
            this.applyCSSCursor(cursor);
        } else if (source === 'direct' && priority >= this.config.priority.direct) {
            this.applyDirectCursor(cursor);
        }
    }
    
    /**
     * Apply direct cursor
     */
    applyDirectCursor(cursor) {
        // Remove CSS cursor
        this.state.pianoRollElement.removeAttribute('data-cursor');
        
        // Remove premium cursor classes
        this.state.pianoRollElement.classList.remove(
            'premium-cursor', 'custom-cursor', 'cursor-animated'
        );
        
        // Set direct style
        this.state.pianoRollElement.style.cursor = cursor;
    }
    
    /**
     * Clear all cursors
     */
    clearAllCursors() {
        if (!this.state.pianoRollElement) return;
        
        // Remove data-cursor attribute
        this.state.pianoRollElement.removeAttribute('data-cursor');
        
        // Clear style cursor
        this.state.pianoRollElement.style.cursor = '';
        
        // Remove cursor classes
        this.state.pianoRollElement.classList.remove(
            'premium-cursor', 'custom-cursor', 'cursor-animated'
        );
    }
    
    /**
     * Get CSS fallback for cursor
     */
    getCSSFallback(cursor) {
        const fallbackMap = {
            'select-premium': 'default',
            'paint-premium': 'crosshair',
            'erase-premium': 'not-allowed',
            'resize-left-premium': 'w-resize',
            'resize-right-premium': 'e-resize',
            'resize-both-premium': 'nw-resize',
            'move-premium': 'move',
            'grab-premium': 'grab',
            'grabbing-premium': 'grabbing'
        };
        
        return fallbackMap[cursor] || 'default';
    }
    
    /**
     * Set cursor with priority
     */
    setCursor(cursor, source = 'direct', priority = CURSOR_PRIORITY_LEVELS.MEDIUM) {
        this.handleCursorChange({ cursor, source, priority });
    }
    
    /**
     * Get current cursor
     */
    getCurrentCursor() {
        return this.state.current;
    }
    
    /**
     * Get cursor conflicts
     */
    getConflicts() {
        return this.state.conflicts;
    }
    
    /**
     * Clear conflicts
     */
    clearConflicts() {
        this.state.conflicts = [];
        this.state.lastConflict = null;
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdate', this.config);
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            updateCount: this.state.updateCount,
            averageUpdateTime: this.state.averageUpdateTime,
            conflicts: this.state.conflicts.length,
            lastConflict: this.state.lastConflict?.timestamp
        };
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        // Clear all listeners
        this.state.listeners.forEach((listener, key) => {
            if (key === 'domObserver') {
                listener.disconnect();
            } else if (key === 'styleObserver' || key === 'performanceMonitor') {
                clearInterval(listener);
            }
        });
        
        this.state.listeners.clear();
        this.removeAllListeners();
        
        console.log('🔧 Cursor Integration Fix destroyed');
    }
}

export default CursorIntegrationFix;
