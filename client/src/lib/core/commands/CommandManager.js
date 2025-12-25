/**
 * CommandManager - Command Pattern Implementation
 * 
 * Provides undo/redo functionality for all state mutations.
 * Each command encapsulates an action and its inverse.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │              CommandManager                      │
 * │  ┌──────────────┬──────────────────────────────┐│
 * │  │   History    │       Command Queue          ││
 * │  │  ┌────────┐  │  ┌─────┬─────┬─────┬─────┐  ││
 * │  │  │ Past   │  │  │ Cmd │ Cmd │ Cmd │ Cmd │  ││
 * │  │  │ Stack  │  │  └─────┴─────┴─────┴─────┘  ││
 * │  │  ├────────┤  │                              ││
 * │  │  │ Future │  │                              ││
 * │  │  │ Stack  │  │                              ││
 * │  │  └────────┘  │                              ││
 * │  └──────────────┴──────────────────────────────┘│
 * └─────────────────────────────────────────────────┘
 * 
 * Usage:
 * ```javascript
 * const manager = new CommandManager();
 * manager.execute(new AddNoteCommand(note));
 * manager.undo(); // Removes the note
 * manager.redo(); // Adds the note back
 * ```
 * 
 * @module lib/core/commands/CommandManager
 */

/**
 * Base Command interface
 * All commands must implement execute() and undo()
 */
export class Command {
    constructor(name = 'Command') {
        this.name = name;
        this.timestamp = Date.now();
    }

    /**
     * Execute the command
     * @returns {any} Result of the command
     */
    execute() {
        throw new Error('Command.execute() must be implemented');
    }

    /**
     * Undo the command
     * @returns {any} Result of the undo
     */
    undo() {
        throw new Error('Command.undo() must be implemented');
    }

    /**
     * Get command description for logging
     * @returns {string}
     */
    getDescription() {
        return this.name;
    }
}

/**
 * CommandManager - Manages command history and undo/redo
 */
export class CommandManager {
    constructor(options = {}) {
        this.history = [];        // Past commands (undo stack)
        this.redoStack = [];      // Future commands (redo stack)
        this.maxHistory = options.maxHistory || 50;
        this.isExecuting = false; // Prevent re-entrancy
        this.listeners = new Set();

        // Batch mode for grouping multiple commands
        this.batchMode = false;
        this.batchCommands = [];
        this.batchName = '';
    }

    /**
     * Execute a command and add to history
     * @param {Command} command 
     * @returns {any} Result of command execution
     */
    execute(command) {
        if (this.isExecuting) {
            console.warn('CommandManager: Re-entrant execution detected');
            return null;
        }

        try {
            this.isExecuting = true;

            // Execute the command
            const result = command.execute();

            // If in batch mode, collect commands
            if (this.batchMode) {
                this.batchCommands.push(command);
                return result;
            }

            // Add to history
            this.history.push(command);

            // Clear redo stack (new action invalidates future)
            this.redoStack = [];

            // Trim history if too long
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            // Notify listeners
            this._notifyListeners('execute', command);

            return result;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Undo the last command
     * @returns {boolean} Whether undo was successful
     */
    undo() {
        if (this.history.length === 0) {
            console.log('CommandManager: Nothing to undo');
            return false;
        }

        try {
            this.isExecuting = true;

            // Pop from history
            const command = this.history.pop();

            // Execute undo
            command.undo();

            // Push to redo stack
            this.redoStack.push(command);

            // Notify listeners
            this._notifyListeners('undo', command);

            console.log(`⏪ Undo: ${command.getDescription()}`);
            return true;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Redo the last undone command
     * @returns {boolean} Whether redo was successful
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('CommandManager: Nothing to redo');
            return false;
        }

        try {
            this.isExecuting = true;

            // Pop from redo stack
            const command = this.redoStack.pop();

            // Execute the command again
            command.execute();

            // Push back to history
            this.history.push(command);

            // Notify listeners
            this._notifyListeners('redo', command);

            console.log(`⏩ Redo: ${command.getDescription()}`);
            return true;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Start batch mode - group multiple commands into one undo
     * @param {string} batchName - Name for the batch command
     */
    beginBatch(batchName = 'Batch') {
        if (this.batchMode) {
            console.warn('CommandManager: Already in batch mode');
            return;
        }

        this.batchMode = true;
        this.batchName = batchName;
        this.batchCommands = [];
    }

    /**
     * End batch mode and commit all commands as one
     */
    endBatch() {
        if (!this.batchMode) {
            console.warn('CommandManager: Not in batch mode');
            return;
        }

        this.batchMode = false;

        if (this.batchCommands.length === 0) {
            return;
        }

        // Create a composite command
        const batchCommand = new BatchCommand(this.batchName, this.batchCommands);

        // Add to history
        this.history.push(batchCommand);
        this.redoStack = [];

        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Notify listeners
        this._notifyListeners('execute', batchCommand);

        this.batchCommands = [];
        this.batchName = '';
    }

    /**
     * Cancel batch mode without committing
     */
    cancelBatch() {
        if (!this.batchMode) return;

        // Undo all batch commands
        for (let i = this.batchCommands.length - 1; i >= 0; i--) {
            this.batchCommands[i].undo();
        }

        this.batchMode = false;
        this.batchCommands = [];
        this.batchName = '';
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.history.length > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get the last command description
     * @returns {string|null}
     */
    getLastCommandDescription() {
        if (this.history.length === 0) return null;
        return this.history[this.history.length - 1].getDescription();
    }

    /**
     * Get the next redo command description
     * @returns {string|null}
     */
    getNextRedoDescription() {
        if (this.redoStack.length === 0) return null;
        return this.redoStack[this.redoStack.length - 1].getDescription();
    }

    /**
     * Add a listener for command events
     * @param {Function} listener 
     */
    addListener(listener) {
        this.listeners.add(listener);
    }

    /**
     * Remove a listener
     * @param {Function} listener 
     */
    removeListener(listener) {
        this.listeners.delete(listener);
    }

    /**
     * Clear all history
     */
    clear() {
        this.history = [];
        this.redoStack = [];
        this._notifyListeners('clear', null);
    }

    /**
     * Get history for debugging
     * @returns {Array}
     */
    getHistory() {
        return this.history.map(cmd => ({
            name: cmd.name,
            description: cmd.getDescription(),
            timestamp: cmd.timestamp
        }));
    }

    /**
     * Notify listeners of command events
     * @private
     */
    _notifyListeners(action, command) {
        this.listeners.forEach(listener => {
            try {
                listener({
                    action,
                    command,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            } catch (error) {
                console.error('CommandManager listener error:', error);
            }
        });
    }
}

/**
 * BatchCommand - Groups multiple commands into one
 */
export class BatchCommand extends Command {
    constructor(name, commands) {
        super(name);
        this.commands = commands;
    }

    execute() {
        // Commands are already executed during batch collection
        // This is only called during redo
        this.commands.forEach(cmd => cmd.execute());
    }

    undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }

    getDescription() {
        return `${this.name} (${this.commands.length} actions)`;
    }
}

// Global command manager instance
export const globalCommandManager = new CommandManager();
