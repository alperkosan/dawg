/**
 * BASE SINGLETON PATTERN
 *
 * Unified singleton implementation for all singleton classes in DAWG.
 * Provides:
 * - Lazy initialization
 * - Async support
 * - Race condition protection
 * - Memory cleanup
 * - Lifecycle event notifications
 * - Thread-safe instance management
 *
 * @example
 * class MyService extends BaseSingleton {
 *   static async _createInstance() {
 *     const instance = new MyService();
 *     await instance.initialize();
 *     return instance;
 *   }
 * }
 *
 * // Usage
 * const service = await MyService.getInstance();
 */

export class BaseSingleton {
  /**
   * Singleton instance
   * @type {any}
   * @private
   */
  static instance = null;

  /**
   * Promise for async initialization (prevents race conditions)
   * @type {Promise<any> | null}
   * @private
   */
  static initPromise = null;

  /**
   * Event subscribers for lifecycle notifications
   * @type {Set<Function>}
   * @private
   */
  static subscribers = new Set();

  /**
   * Get singleton instance (async)
   * Creates instance on first call, returns cached instance thereafter
   *
   * @returns {Promise<any>} The singleton instance
   * @throws {Error} If initialization fails
   *
   * @example
   * const controller = await PlaybackController.getInstance();
   */
  static async getInstance() {
    // Return existing instance if available
    if (this.instance) {
      return this.instance;
    }

    // Wait for ongoing initialization if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this._initializeInstance();

    try {
      this.instance = await this.initPromise;
      this._notifySubscribers('initialized', this.instance);
      console.log(`✅ ${this.name} singleton initialized`);
      return this.instance;
    } catch (error) {
      this.initPromise = null;
      console.error(`❌ ${this.name} singleton initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Get singleton instance synchronously (returns null if not initialized)
   * Use this when you're sure the instance is already created
   *
   * @returns {any | null} The instance or null if not initialized
   *
   * @example
   * const controller = PlaybackController.getInstanceSync();
   * if (controller) {
   *   controller.play();
   * }
   */
  static getInstanceSync() {
    return this.instance;
  }

  /**
   * Check if singleton is initialized
   *
   * @returns {boolean} True if instance exists
   */
  static isReady() {
    return this.instance !== null;
  }

  /**
   * Check if initialization is in progress
   *
   * @returns {boolean} True if currently initializing
   */
  static isInitializing() {
    return this.initPromise !== null && this.instance === null;
  }

  /**
   * Create singleton instance (MUST be implemented by subclass)
   * This is called once during first getInstance() call
   *
   * @returns {Promise<any>} The created instance
   * @throws {Error} If not implemented
   * @private
   */
  static async _createInstance() {
    throw new Error(
      `${this.name}._createInstance() must be implemented by subclass`
    );
  }

  /**
   * Initialize instance (wrapper with error handling)
   * @private
   */
  static async _initializeInstance() {
    this._notifySubscribers('initializing', null);

    try {
      const instance = await this._createInstance();

      if (!instance) {
        throw new Error(`${this.name}._createInstance() returned null/undefined`);
      }

      return instance;
    } catch (error) {
      this._notifySubscribers('error', error);
      throw error;
    }
  }

  /**
   * Reset singleton (destroy and clear instance)
   * Useful for testing and cleanup
   *
   * @param {boolean} silent - If true, don't notify subscribers
   */
  static reset(silent = false) {
    if (this.instance) {
      // Call destroy method if it exists
      if (typeof this.instance.destroy === 'function') {
        try {
          this.instance.destroy();
        } catch (error) {
          console.warn(`Error destroying ${this.name} instance:`, error);
        }
      }

      // Call dispose method if it exists
      if (typeof this.instance.dispose === 'function') {
        try {
          this.instance.dispose();
        } catch (error) {
          console.warn(`Error disposing ${this.name} instance:`, error);
        }
      }

      if (!silent) {
        this._notifySubscribers('reset', this.instance);
      }

      this.instance = null;
      this.initPromise = null;

      console.log(`🔄 ${this.name} singleton reset`);
    }
  }

  /**
   * Subscribe to singleton lifecycle events
   *
   * @param {Function} callback - Called with (event, data)
   * @returns {Function} Unsubscribe function
   *
   * Events:
   * - 'initializing': Initialization started
   * - 'initialized': Instance created successfully
   * - 'error': Initialization failed
   * - 'reset': Instance destroyed
   *
   * @example
   * const unsubscribe = PlaybackController.onLifecycle((event, data) => {
   *   if (event === 'initialized') {
   *     console.log('Controller ready:', data);
   *   }
   * });
   */
  static onLifecycle(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Lifecycle callback must be a function');
    }

    this.subscribers.add(callback);

    // Immediately notify if already initialized
    if (this.instance) {
      try {
        callback('initialized', this.instance);
      } catch (error) {
        console.error('Error in lifecycle callback:', error);
      }
    }

    // Return unsubscribe function
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of lifecycle event
   * @private
   */
  static _notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error(`Error in ${this.name} lifecycle subscriber:`, error);
      }
    });
  }

  /**
   * Get number of active subscribers
   * @returns {number}
   */
  static getSubscriberCount() {
    return this.subscribers.size;
  }

  /**
   * Clear all subscribers (useful for cleanup)
   */
  static clearSubscribers() {
    this.subscribers.clear();
  }

  /**
   * Create instance with dependency injection (optional helper)
   * Useful when dependencies need to be passed to constructor
   *
   * @param {Object} dependencies - Dependencies to inject
   * @returns {Promise<any>} Singleton instance
   *
   * @example
   * class MyService extends BaseSingleton {
   *   static async _createInstance() {
   *     return this.createWithDependencies({
   *       audioContext: await AudioContextService.getInstance(),
   *       eventBus: EventBus.getInstance()
   *     });
   *   }
   * }
   */
  static async createWithDependencies(dependencies) {
    // Subclass should override this or use _createInstance directly
    throw new Error(
      `${this.name}.createWithDependencies() not implemented. Override _createInstance() instead.`
    );
  }
}

// Export for testing
export const __test__ = {
  BaseSingleton
};
