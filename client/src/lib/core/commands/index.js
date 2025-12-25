/**
 * Commands - Barrel Export
 * 
 * Command Pattern implementation for undo/redo functionality.
 * All state mutations can be wrapped in commands for full undo support.
 * 
 * Usage:
 * ```javascript
 * import { globalCommandManager, AddNoteCommand } from '@/lib/core/commands';
 * 
 * // Execute with undo support
 * globalCommandManager.execute(
 *   new AddNoteCommand(useArrangementStore, patternId, instrumentId, note)
 * );
 * 
 * // Undo/Redo
 * globalCommandManager.undo();
 * globalCommandManager.redo();
 * 
 * // Batch multiple operations
 * globalCommandManager.beginBatch('Multi-select delete');
 * notes.forEach(note => {
 *   globalCommandManager.execute(new RemoveNoteCommand(...));
 * });
 * globalCommandManager.endBatch(); // One undo step for all
 * ```
 * 
 * @module lib/core/commands
 */

// Core command infrastructure
export { Command, CommandManager, BatchCommand, globalCommandManager } from './CommandManager.js';

// Pattern commands
export {
    AddNoteCommand,
    RemoveNoteCommand,
    MoveNoteCommand,
    ChangeVelocityCommand,
    ChangeDurationCommand,
    CreatePatternCommand,
    DeletePatternCommand
} from './PatternCommands.js';

// Mixer commands
export {
    ChangeVolumeCommand,
    ChangePanCommand,
    ToggleMuteCommand,
    ToggleSoloCommand,
    AddEffectCommand,
    RemoveEffectCommand,
    ChangeEffectParamCommand,
    ReorderEffectCommand
} from './MixerCommands.js';
