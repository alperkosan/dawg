/**
 * Type definitions for Command Pattern
 * 
 * @module lib/core/commands/types
 */

import type { PooledNote } from '../types';

// =================== COMMAND MANAGER ===================

export interface CommandManagerOptions {
    maxHistory?: number;
}

export interface CommandEvent {
    action: 'execute' | 'undo' | 'redo' | 'clear';
    command: Command | null;
    canUndo: boolean;
    canRedo: boolean;
}

export type CommandListener = (event: CommandEvent) => void;

export interface HistoryEntry {
    name: string;
    description: string;
    timestamp: number;
}

// =================== BASE COMMAND ===================

export abstract class Command {
    name: string;
    timestamp: number;

    constructor(name?: string);
    abstract execute(): any;
    abstract undo(): any;
    getDescription(): string;
}

// =================== PATTERN COMMANDS ===================

export interface NoteData {
    id?: string;
    pitch: number;
    velocity: number;
    step: number;
    duration: number;
}

export interface PatternStore {
    getState(): {
        patterns: Map<string, PatternData>;
        addNote(patternId: string, instrumentId: string, note: NoteData): NoteData;
        removeNote(patternId: string, instrumentId: string, noteId: string): void;
        updateNote(patternId: string, instrumentId: string, noteId: string, updates: Partial<NoteData>): void;
        createPattern(name: string): PatternData;
        deletePattern(patternId: string): void;
    };
}

export interface PatternData {
    id: string;
    name: string;
    length: number;
    data: Record<string, NoteData[]>;
}

// Pattern command interfaces
export interface AddNoteCommand extends Command {
    store: PatternStore;
    patternId: string;
    instrumentId: string;
    noteData: NoteData;
    createdNote: NoteData | null;
}

export interface RemoveNoteCommand extends Command {
    store: PatternStore;
    patternId: string;
    instrumentId: string;
    noteId: string;
    removedNote: NoteData | null;
}

export interface MoveNoteCommand extends Command {
    store: PatternStore;
    patternId: string;
    instrumentId: string;
    noteId: string;
    newStep: number;
    newPitch: number;
    oldStep: number;
    oldPitch: number;
}

export interface ChangeVelocityCommand extends Command {
    store: PatternStore;
    patternId: string;
    instrumentId: string;
    noteId: string;
    newVelocity: number;
    oldVelocity: number;
}

export interface ChangeDurationCommand extends Command {
    store: PatternStore;
    patternId: string;
    instrumentId: string;
    noteId: string;
    newDuration: number;
    oldDuration: number;
}

// =================== MIXER COMMANDS ===================

export interface MixerStore {
    getState(): {
        mixerTracks: MixerTrack[];
        handleMixerParamChange(trackId: string, param: string, value: any): void;
        toggleMute(trackId: string): void;
        toggleSolo(trackId: string): void;
        handleMixerEffectAdd(trackId: string, effectType: string): any;
        handleMixerEffectRemove(trackId: string, effectId: string): void;
        handleMixerEffectChange(trackId: string, effectId: string, param: string, value: any): void;
        reorderEffect(trackId: string, sourceIndex: number, destIndex: number): void;
    };
}

export interface MixerTrack {
    id: string;
    name: string;
    type: 'track' | 'bus' | 'master';
    volume: number;
    pan: number;
    isMuted: boolean;
    isSolo: boolean;
    insertEffects: EffectInstance[];
}

export interface EffectInstance {
    id: string;
    type: string;
    settings: Record<string, any>;
    bypass: boolean;
}

// Mixer command interfaces
export interface ChangeVolumeCommand extends Command {
    store: MixerStore;
    trackId: string;
    newVolume: number;
    oldVolume: number;
}

export interface ChangePanCommand extends Command {
    store: MixerStore;
    trackId: string;
    newPan: number;
    oldPan: number;
}

export interface ToggleMuteCommand extends Command {
    store: MixerStore;
    trackId: string;
    wasMuted: boolean | null;
}

export interface ToggleSoloCommand extends Command {
    store: MixerStore;
    trackId: string;
    wasSoloed: boolean | null;
}

export interface AddEffectCommand extends Command {
    store: MixerStore;
    trackId: string;
    effectType: string;
    settings: Record<string, any>;
    createdEffect: EffectInstance | null;
}

export interface RemoveEffectCommand extends Command {
    store: MixerStore;
    trackId: string;
    effectId: string;
    removedEffect: EffectInstance | null;
    effectIndex: number;
}

export interface ChangeEffectParamCommand extends Command {
    store: MixerStore;
    trackId: string;
    effectId: string;
    param: string;
    newValue: any;
    oldValue: any;
}

export interface ReorderEffectCommand extends Command {
    store: MixerStore;
    trackId: string;
    sourceIndex: number;
    destIndex: number;
}

// =================== BATCH COMMAND ===================

export interface BatchCommand extends Command {
    commands: Command[];
}
