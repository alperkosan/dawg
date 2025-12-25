/**
 * @fileoverview Tests for AudioObjectPool
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AudioObjectPool, audioObjectPool } from '@/lib/core/utils/AudioObjectPool.js';

describe('AudioObjectPool', () => {
    let pool;

    beforeEach(() => {
        pool = new AudioObjectPool({
            notePoolSize: 10,
            voicePoolSize: 5,
            eventPoolSize: 10
        });
    });

    afterEach(() => {
        pool.dispose();
    });

    describe('Note Pool', () => {
        it('should acquire and release notes', () => {
            const note = pool.acquireNote();
            expect(note).toBeDefined();
            expect(note.pitch).toBe(0);
            expect(note.isActive).toBe(false);

            pool.releaseNote(note);

            const stats = pool.getStats();
            expect(stats.notePool.active).toBe(0);
        });

        it('should create notes with data', () => {
            const note = pool.createNote({
                pitch: 60,
                velocity: 0.8,
                step: 4,
                duration: 2
            });

            expect(note.pitch).toBe(60);
            expect(note.velocity).toBe(0.8);
            expect(note.step).toBe(4);
            expect(note.duration).toBe(2);
            expect(note.isActive).toBe(true);
            expect(note.id).toBeTruthy();
        });

        it('should reuse released notes', () => {
            const note1 = pool.acquireNote();
            note1.pitch = 60;
            pool.releaseNote(note1);

            const note2 = pool.acquireNote();
            expect(note2).toBe(note1);
            expect(note2.pitch).toBe(0); // Should be reset
        });
    });

    describe('Voice Pool', () => {
        it('should allocate voices', () => {
            const voice = pool.allocateVoice('inst-1', 60, 0.8, 0.5);

            expect(voice.instrumentId).toBe('inst-1');
            expect(voice.pitch).toBe(60);
            expect(voice.velocity).toBe(0.8);
            expect(voice.startTime).toBe(0.5);
            expect(voice.state).toBe('attack');
        });

        it('should release and reuse voices', () => {
            const voice1 = pool.acquireVoice();
            voice1.pitch = 72;
            pool.releaseVoice(voice1);

            const voice2 = pool.acquireVoice();
            expect(voice2).toBe(voice1);
            expect(voice2.pitch).toBe(0);
            expect(voice2.state).toBe('free');
        });
    });

    describe('Event Pool', () => {
        it('should create events', () => {
            const event = pool.createEvent('noteOn', 1.0, { pitch: 60 });

            expect(event.type).toBe('noteOn');
            expect(event.time).toBe(1.0);
            expect(event.data).toEqual({ pitch: 60 });
            expect(event.executed).toBe(false);
            expect(event.cancelled).toBe(false);
        });

        it('should reset events on release', () => {
            const event = pool.createEvent('noteOn', 1.0, { pitch: 60 });
            event.executed = true;
            pool.releaseEvent(event);

            const event2 = pool.acquireEvent();
            expect(event2).toBe(event);
            expect(event2.type).toBeNull();
            expect(event2.executed).toBe(false);
        });
    });

    describe('Typed Array Buffers', () => {
        it('should provide temp buffers', () => {
            const bufferL = pool.getTempBufferL();
            const bufferR = pool.getTempBufferR();

            expect(bufferL).toBeInstanceOf(Float32Array);
            expect(bufferR).toBeInstanceOf(Float32Array);
            expect(bufferL.length).toBe(128);
        });

        it('should provide mix buffer', () => {
            const mixBuffer = pool.getMixBuffer();
            expect(mixBuffer).toBeInstanceOf(Float32Array);
            expect(mixBuffer.length).toBe(256); // 128 * 2 for stereo
        });

        it('should provide level buffer', () => {
            const levelBuffer = pool.getLevelBuffer();
            expect(levelBuffer).toBeInstanceOf(Float32Array);
            expect(levelBuffer.length).toBe(64); // 32 stereo channels
        });

        it('should clear temp buffers on get', () => {
            const buffer = pool.getTempBufferL();
            buffer[0] = 1.0;

            const buffer2 = pool.getTempBufferL();
            expect(buffer2[0]).toBe(0);
        });
    });

    describe('Stats', () => {
        it('should track pool statistics', () => {
            pool.acquireNote();
            pool.acquireNote();
            pool.acquireVoice();

            const stats = pool.getStats();

            expect(stats.notePool.active).toBe(2);
            expect(stats.voicePool.active).toBe(1);
            expect(stats.eventPool.active).toBe(0);
        });
    });

    describe('Global Instance', () => {
        it('should export a global singleton', () => {
            expect(audioObjectPool).toBeInstanceOf(AudioObjectPool);
        });
    });
});
