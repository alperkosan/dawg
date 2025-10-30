/**
 * Piano Roll Cursor Manager - Unified Cursor Management
 * 
 * Bu dosya, piano roll için birleşik cursor yönetimi sağlar.
 * Tüm cursor sistemlerini tek bir merkezi noktada yönetir.
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
import { CursorIntegrationFix } from './CursorIntegrationFix';
import { PremiumCursorSystem } from './PremiumCursorSystem';
import { ProfessionalCursorSystem } from './ProfessionalCursorSystem';

// ✅ CURSOR MANAGER CONSTANTS
export const CURSOR_MANAGER_MODES = {
    AUTOMATIC: 'automatic',     // Otomatik cursor seçimi
    MANUAL: 'manual',          // Manuel cursor kontrolü
    HYBRID: 'hybrid'           // Hibrit mod
};

export const CURSOR_SOURCES = {
    PREMIUM: 'premium',
    PROFESSIONAL: 'professional',
    CSS: 'css',
    DIRECT: 'direct',
    SYSTEM: 'system'
};

/**
 * Piano Roll Cursor Manager
 * 
 * Bu sınıf, piano roll için birleşik cursor yönetimi sağlar.
 * Tüm cursor sistemlerini tek bir merkezi noktada yönetir.
 */
export class PianoRollCursorManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Manager mode
            mode: CURSOR_MANAGER_MODES.AUTOMATIC,
            
            // Cursor system preferences
            preferredSystem: CURSOR_SOURCES.PREMIUM,
            fallbackSystem: CURSOR_SOURCES.CSS,
            
            // Integration settings
            integration: {
                enabled: true,
                autoDetect: true,
                conflictResolution: true,
                performanceOptimization: true
            },
            
            // Piano roll targeting
            pianoRollSelector: '.prv5-canvas-container',
            pianoRollElement: null,
            
            // Cursor mapping
            cursorMapping: {
                // Tool to cursor mapping
                'select': 'select-premium',
                'paintBrush': 'paint-premium',
                'eraser': 'erase-premium',
                'slice': 'slice-premium',
                'slide': 'slide-premium',
                
                // State to cursor mapping
                'hover': 'select-premium',
                'active': 'select-premium',
                'resizing': 'resize-both-premium',
                'moving': 'move-premium',
                'grabbing': 'grabbing-premium'
            },
            
            // Performance settings
            performance: {
                debounceMs: 16,
                throttleMs: 8,
                maxUpdatesPerSecond: 60,
                enableCaching: true,
                enableBatching: true
            },
            
            // Debug settings
            debug: {
                enabled: false,
                logCursorChanges: false,
                logSystemSwitches: false,
                logPerformance: false
            },
            
            ...options
        };
        
        // State management
        this.state = {
            // Current cursor
            current: null,
            previous: null,
            source: null,
            
            // Active systems
            activeSystems: new Map(),
            systemPriorities: new Map(),
            
            // Piano roll element
            pianoRollElement: null,
            
            // Performance tracking
            updateCount: 0,
            lastUpdate: 0,
            averageUpdateTime: 0,
            
            // Cursor cache
            cursorCache: new Map(),
            
            // Event listeners
            listeners: new Map()
        };
        
        // Initialize systems
        this.initialize();
    }
    
    /**
     * Initialize the cursor manager
     */
    initialize() {
        this.findPianoRollElement();
        // Wait for element to be found before initializing systems
        this.waitForElementAndInitialize();
        this.setupEventListeners();
        this.setupPerformanceMonitoring();
        
        console.log('🎯 Piano Roll Cursor Manager initialized');
    }
    
    /**
     * Wait for element and initialize systems
     */
    waitForElementAndInitialize() {
        const checkElement = () => {
            if (this.state.pianoRollElement) {
                this.initializeSystems();
            } else {
                setTimeout(checkElement, 100);
            }
        };
        checkElement();
    }
    
    /**
     * Find piano roll element
     */
    findPianoRollElement() {
        const element = document.querySelector(this.config.pianoRollSelector);
        if (element) {
            this.state.pianoRollElement = element;
            this.config.pianoRollElement = element;
            console.log('🎹 Piano roll element found:', element);
        } else {
            console.warn('⚠️ Piano roll element not found, will retry...');
            setTimeout(() => this.findPianoRollElement(), 100);
        }
    }
    
    /**
     * Initialize cursor systems
     */
    initializeSystems() {
        // Initialize integration fix
        this.state.activeSystems.set('integration', new CursorIntegrationFix({
            pianoRollElement: this.state.pianoRollElement,
            mode: 'unified'
        }));
        
        // Initialize premium cursor system
        this.state.activeSystems.set('premium', new PremiumCursorSystem({
            pianoRollElement: this.state.pianoRollElement
        }));
        
        // Initialize professional cursor system
        this.state.activeSystems.set('professional', new ProfessionalCursorSystem({
            pianoRollElement: this.state.pianoRollElement
        }));
        
        // Set system priorities
        this.state.systemPriorities.set('premium', 3);
        this.state.systemPriorities.set('professional', 2);
        this.state.systemPriorities.set('css', 1);
        this.state.systemPriorities.set('direct', 0);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for cursor changes from all systems
        this.state.activeSystems.forEach((system, name) => {
            system.on('cursorChange', (data) => {
                this.handleCursorChange(data, name);
            });
            
            system.on('cursorApplied', (data) => {
                this.handleCursorApplied(data, name);
            });
        });
        
        // Listen for piano roll events
        this.setupPianoRollEventListeners();
    }
    
    /**
     * Setup piano roll event listeners
     */
    setupPianoRollEventListeners() {
        if (!this.state.pianoRollElement) {
            console.warn('⚠️ Piano roll element not found, cannot setup event listeners');
            return;
        }
        
        try {
            // Mouse events
            this.state.pianoRollElement.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
            this.state.pianoRollElement.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
            this.state.pianoRollElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.state.pianoRollElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.state.pianoRollElement.addEventListener('mouseup', this.handleMouseUp.bind(this));
            
            // Tool change events
            this.state.pianoRollElement.addEventListener('toolchange', this.handleToolChange.bind(this));
            
            // State change events
            this.state.pianoRollElement.addEventListener('statechange', this.handleStateChange.bind(this));
        } catch (error) {
            console.error('❌ Error setting up piano roll event listeners:', error);
        }
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
                console.log('📊 Cursor Manager Performance:', {
                    updateCount: this.state.updateCount,
                    averageUpdateTime: this.state.averageUpdateTime.toFixed(2) + 'ms',
                    activeSystems: Array.from(this.state.activeSystems.keys())
                });
            }
        };
        
        const interval = setInterval(monitor, 1000);
        this.state.listeners.set('performanceMonitor', interval);
    }
    
    /**
     * Handle cursor change
     */
    handleCursorChange(data, source) {
        const { cursor, priority } = data;
        
        // Check if we should switch systems
        if (this.shouldSwitchSystem(source, priority)) {
            this.switchSystem(source);
        }
        
        // Update state
        this.state.previous = this.state.current;
        this.state.current = { cursor, source, priority, timestamp: Date.now() };
        
        // Apply cursor
        this.applyCursor(cursor, source, priority);
        
        // Emit change event
        this.emit('cursorChange', {
            cursor,
            source,
            priority,
            previous: this.state.previous
        });
    }
    
    /**
     * Handle cursor applied
     */
    handleCursorApplied(data, source) {
        if (this.config.debug.logCursorChanges) {
            console.log('✅ Cursor applied:', { ...data, source });
        }
        
        this.emit('cursorApplied', { ...data, source });
    }
    
    /**
     * Should switch system
     */
    shouldSwitchSystem(source, priority) {
        if (this.config.mode === CURSOR_MANAGER_MODES.MANUAL) {
            return false;
        }
        
        const currentPriority = this.state.systemPriorities.get(this.state.source) || 0;
        const incomingPriority = this.state.systemPriorities.get(source) || 0;
        
        return incomingPriority > currentPriority;
    }
    
    /**
     * Switch cursor system
     */
    switchSystem(source) {
        if (this.state.source === source) return;
        
        const previousSource = this.state.source;
        this.state.source = source;
        
        if (this.config.debug.logSystemSwitches) {
            console.log(`🔄 Switched cursor system: ${previousSource} → ${source}`);
        }
        
        this.emit('systemSwitch', {
            from: previousSource,
            to: source,
            timestamp: Date.now()
        });
    }
    
    /**
     * Apply cursor
     */
    applyCursor(cursor, source, priority) {
        if (!this.state.pianoRollElement) {
            console.warn('⚠️ Piano roll element not found, cannot apply cursor');
            return;
        }
        
        // Get the appropriate system
        const system = this.getSystemForSource(source);
        if (!system) {
            console.warn(`⚠️ System not found for source: ${source}`);
            return;
        }
        
        // Apply cursor through the system
        if (system.setCursor) {
            system.setCursor(cursor, priority);
        } else if (system.applyCursor) {
            system.applyCursor(cursor, priority);
        }
    }
    
    /**
     * Get system for source
     */
    getSystemForSource(source) {
        // Handle special sources
        if (source === CURSOR_SOURCES.DIRECT || source === CURSOR_SOURCES.CSS) {
            // Direct and CSS sources use the piano roll element directly
            return {
                setCursor: (cursor) => {
                    if (this.state.pianoRollElement) {
                        this.state.pianoRollElement.style.cursor = cursor.replace('-premium', '').replace('-professional', '');
                    }
                }
            };
        }
        
        // Map source to system
        const systemMap = {
            [CURSOR_SOURCES.PREMIUM]: 'premium',
            [CURSOR_SOURCES.PROFESSIONAL]: 'professional',
            [CURSOR_SOURCES.SYSTEM]: 'premium' // Default to premium for system
        };
        
        const systemKey = systemMap[source];
        return this.state.activeSystems.get(systemKey);
    }
    
    /**
     * Set cursor with automatic system selection
     */
    setCursor(cursor, options = {}) {
        // Validate cursor
        if (!cursor || cursor === 'undefined') {
            console.warn('⚠️ PianoRollCursorManager: Invalid cursor type:', cursor);
            return;
        }
        
        const { source, priority, force } = options;
        
        // Determine source
        const cursorSource = source || this.determineBestSource(cursor);
        
        // Determine priority
        const cursorPriority = priority || this.determinePriority(cursorSource);
        
        // Apply cursor
        this.applyCursor(cursor, cursorSource, cursorPriority);
        
        // Update state
        this.state.previous = this.state.current;
        this.state.current = { cursor, source: cursorSource, priority: cursorPriority, timestamp: Date.now() };
    }
    
    /**
     * Determine best source for cursor
     */
    determineBestSource(cursor) {
        // Check if cursor is premium
        if (cursor.includes('-premium')) {
            return CURSOR_SOURCES.PREMIUM;
        }
        
        // Check if cursor is professional
        if (cursor.includes('-professional')) {
            return CURSOR_SOURCES.PROFESSIONAL;
        }
        
        // Check if cursor is CSS-based
        if (this.isCSSCursor(cursor)) {
            return CURSOR_SOURCES.CSS;
        }
        
        // Default to preferred system
        return this.config.preferredSystem;
    }
    
    /**
     * Determine priority for source
     */
    determinePriority(source) {
        return this.state.systemPriorities.get(source) || 0;
    }
    
    /**
     * Check if cursor is CSS-based
     */
    isCSSCursor(cursor) {
        const cssCursors = [
            'default', 'auto', 'pointer', 'crosshair', 'move', 'grab', 'grabbing',
            'text', 'wait', 'help', 'not-allowed', 'all-scroll', 'col-resize',
            'row-resize', 'n-resize', 'e-resize', 's-resize', 'w-resize',
            'ne-resize', 'nw-resize', 'se-resize', 'sw-resize'
        ];
        
        return cssCursors.includes(cursor);
    }
    
    /**
     * Handle mouse enter
     */
    handleMouseEnter(event) {
        this.emit('mouseEnter', event);
    }
    
    /**
     * Handle mouse leave
     */
    handleMouseLeave(event) {
        this.emit('mouseLeave', event);
    }
    
    /**
     * Handle mouse move
     */
    handleMouseMove(event) {
        this.emit('mouseMove', event);
    }
    
    /**
     * Handle mouse down
     */
    handleMouseDown(event) {
        this.emit('mouseDown', event);
    }
    
    /**
     * Handle mouse up
     */
    handleMouseUp(event) {
        this.emit('mouseUp', event);
    }
    
    /**
     * Handle tool change
     */
    handleToolChange(event) {
        const { tool } = event.detail;
        const cursor = this.config.cursorMapping[tool];
        
        if (cursor) {
            this.setCursor(cursor, { source: CURSOR_SOURCES.SYSTEM });
        }
        
        this.emit('toolChange', { tool, cursor });
    }
    
    /**
     * Handle state change
     */
    handleStateChange(event) {
        const { state } = event.detail;
        const cursor = this.config.cursorMapping[state];
        
        if (cursor) {
            this.setCursor(cursor, { source: CURSOR_SOURCES.SYSTEM });
        }
        
        this.emit('stateChange', { state, cursor });
    }
    
    /**
     * Get current cursor
     */
    getCurrentCursor() {
        return this.state.current;
    }
    
    /**
     * Get active systems
     */
    getActiveSystems() {
        return Array.from(this.state.activeSystems.keys());
    }
    
    /**
     * Get system priorities
     */
    getSystemPriorities() {
        return Object.fromEntries(this.state.systemPriorities);
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
            activeSystems: this.getActiveSystems(),
            currentSource: this.state.source
        };
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        // Destroy all systems
        this.state.activeSystems.forEach((system) => {
            if (system.destroy) {
                system.destroy();
            }
        });
        
        // Clear all listeners
        this.state.listeners.forEach((listener) => {
            clearInterval(listener);
        });
        
        this.state.listeners.clear();
        this.removeAllListeners();
        
        console.log('🎯 Piano Roll Cursor Manager destroyed');
    }
}

export default PianoRollCursorManager;
