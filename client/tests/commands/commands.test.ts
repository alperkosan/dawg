/**
 * @fileoverview Unit tests for Command Pattern implementation
 * Tests CommandManager, Pattern Commands, and Mixer Commands
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    Command,
    CommandManager,
    BatchCommand
} from '@/lib/core/commands/CommandManager.js';

// =================== CommandManager Tests ===================

describe('CommandManager', () => {
    let manager;

    beforeEach(() => {
        manager = new CommandManager({ maxHistory: 10 });
    });

    it('should initialize with empty history', () => {
        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(false);
        expect(manager.getHistory()).toHaveLength(0);
    });

    it('should execute commands and add to history', () => {
        const mockCommand = {
            name: 'Test',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Test Command'
        };

        manager.execute(mockCommand);

        expect(mockCommand.execute).toHaveBeenCalled();
        expect(manager.canUndo()).toBe(true);
        expect(manager.canRedo()).toBe(false);
    });

    it('should undo commands', () => {
        const mockCommand = {
            name: 'Test',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Test Command'
        };

        manager.execute(mockCommand);
        manager.undo();

        expect(mockCommand.undo).toHaveBeenCalled();
        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(true);
    });

    it('should redo commands', () => {
        const mockCommand = {
            name: 'Test',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Test Command'
        };

        manager.execute(mockCommand);
        manager.undo();
        manager.redo();

        expect(mockCommand.execute).toHaveBeenCalledTimes(2);
        expect(manager.canUndo()).toBe(true);
        expect(manager.canRedo()).toBe(false);
    });

    it('should clear redo stack on new execute', () => {
        const cmd1 = {
            name: 'Cmd1',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Cmd1'
        };
        const cmd2 = {
            name: 'Cmd2',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Cmd2'
        };

        manager.execute(cmd1);
        manager.undo();
        expect(manager.canRedo()).toBe(true);

        manager.execute(cmd2);
        expect(manager.canRedo()).toBe(false);
    });

    it('should limit history size', () => {
        const smallManager = new CommandManager({ maxHistory: 3 });

        for (let i = 0; i < 5; i++) {
            smallManager.execute({
                name: `Cmd${i}`,
                timestamp: Date.now(),
                execute: vi.fn().mockReturnValue(true),
                undo: vi.fn(),
                getDescription: () => `Cmd${i}`
            });
        }

        expect(smallManager.getHistory()).toHaveLength(3);
    });

    it('should support batch commands', () => {
        const cmd1 = {
            name: 'Batch1',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Batch1'
        };
        const cmd2 = {
            name: 'Batch2',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Batch2'
        };

        manager.beginBatch('Test Batch');
        manager.execute(cmd1);
        manager.execute(cmd2);
        manager.endBatch();

        expect(manager.getHistory()).toHaveLength(1);
        expect(manager.getLastCommandDescription()).toContain('2 actions');
    });

    it('should cancel batch and undo all', () => {
        const cmd1 = {
            name: 'Batch1',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Batch1'
        };

        manager.beginBatch('Test Batch');
        manager.execute(cmd1);
        manager.cancelBatch();

        expect(cmd1.undo).toHaveBeenCalled();
        expect(manager.getHistory()).toHaveLength(0);
    });

    it('should notify listeners', () => {
        const listener = vi.fn();
        manager.addListener(listener);

        const mockCommand = {
            name: 'Test',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Test'
        };

        manager.execute(mockCommand);

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'execute',
                command: mockCommand,
                canUndo: true
            })
        );
    });

    it('should clear history', () => {
        const mockCommand = {
            name: 'Test',
            timestamp: Date.now(),
            execute: vi.fn().mockReturnValue(true),
            undo: vi.fn(),
            getDescription: () => 'Test'
        };

        manager.execute(mockCommand);
        manager.clear();

        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(false);
    });
});

// =================== Command Base Class Tests ===================

describe('Command', () => {
    it('should throw on execute if not implemented', () => {
        const cmd = new Command('Test');
        expect(() => cmd.execute()).toThrow('must be implemented');
    });

    it('should throw on undo if not implemented', () => {
        const cmd = new Command('Test');
        expect(() => cmd.undo()).toThrow('must be implemented');
    });

    it('should have name and timestamp', () => {
        const cmd = new Command('TestCommand');
        expect(cmd.name).toBe('TestCommand');
        expect(cmd.timestamp).toBeDefined();
        expect(typeof cmd.timestamp).toBe('number');
    });
});

// =================== BatchCommand Tests ===================

describe('BatchCommand', () => {
    it('should execute all child commands on redo', () => {
        const cmd1 = { execute: vi.fn(), undo: vi.fn() };
        const cmd2 = { execute: vi.fn(), undo: vi.fn() };

        const batch = new BatchCommand('Test Batch', [cmd1, cmd2]);
        batch.execute();

        expect(cmd1.execute).toHaveBeenCalled();
        expect(cmd2.execute).toHaveBeenCalled();
    });

    it('should undo child commands in reverse order', () => {
        const order = [];
        const cmd1 = {
            execute: vi.fn(),
            undo: vi.fn(() => order.push('cmd1'))
        };
        const cmd2 = {
            execute: vi.fn(),
            undo: vi.fn(() => order.push('cmd2'))
        };

        const batch = new BatchCommand('Test Batch', [cmd1, cmd2]);
        batch.undo();

        expect(order).toEqual(['cmd2', 'cmd1']);
    });

    it('should have descriptive description', () => {
        const batch = new BatchCommand('Multi-edit', [{}, {}, {}]);
        expect(batch.getDescription()).toBe('Multi-edit (3 actions)');
    });
});
