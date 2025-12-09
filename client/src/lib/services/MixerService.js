/**
 * MixerService
 * 
 * Professional DAW-grade service for real-time mixer parameter manipulation.
 * Provides zero-latency direct audio control without triggering store syncs.
 * 
 * Architecture:
 * - UI → MixerService (imperative commands)
 * - MixerService → AudioEngine (direct AudioParam manipulation)
 * - Store updates are debounced and async (persistence only)
 * 
 * This service complements EngineStateSyncService:
 * - MixerService: Real-time parameter changes (volume, pan, mute, etc.)
 * - EngineStateSyncService: Structural changes (track add/remove, routing)
 */

import { AudioContextService } from './AudioContextService';
import { AudioEngineGlobal } from '../core/AudioEngineGlobal';

export class MixerService {
    /**
     * Get audio engine instance
     * @private
     */
    static _getEngine() {
        return AudioEngineGlobal.get();
    }

    /**
     * Get audio context
     * @private
     */
    static _getContext() {
        const engine = this._getEngine();
        return engine?.audioContext;
    }

    // =================== TRACK VOLUME ===================

    /**
     * Set track volume (direct AudioParam manipulation)
     * @param {string} trackId - Mixer track ID
     * @param {number} db - Volume in decibels (-Infinity to +6)
     */
    static setTrackVolume(trackId, db) {
        const engine = this._getEngine();
        if (!engine) return;

        const insert = engine.mixerInserts?.get(trackId);
        if (!insert?.gainNode) return;

        const linearGain = db === -Infinity ? 0 : Math.pow(10, db / 20);
        const now = engine.audioContext.currentTime;

        // Use setTargetAtTime for smooth, glitch-free transitions
        insert.gainNode.gain.setTargetAtTime(linearGain, now, 0.01); // 10ms time constant
    }

    // =================== TRACK PAN ===================

    /**
     * Set track pan (direct AudioParam manipulation)
     * @param {string} trackId - Mixer track ID
     * @param {number} pan - Pan value (-1 to +1, 0 = center)
     */
    static setTrackPan(trackId, pan) {
        const engine = this._getEngine();
        if (!engine) return;

        const insert = engine.mixerInserts?.get(trackId);
        if (!insert?.panNode) return;

        const clampedPan = Math.max(-1, Math.min(1, pan));
        const now = engine.audioContext.currentTime;

        insert.panNode.pan.setTargetAtTime(clampedPan, now, 0.01);
    }

    // =================== TRACK MUTE ===================

    /**
     * Set track mute state (direct AudioParam manipulation)
     * @param {string} trackId - Mixer track ID
     * @param {boolean} muted - Mute state
     */
    static setTrackMute(trackId, muted) {
        const engine = this._getEngine();
        if (!engine) return;

        const insert = engine.mixerInserts?.get(trackId);
        if (!insert) return;

        const now = engine.audioContext.currentTime;
        const targetGain = muted ? 0 : 1;

        // Use muteGain node if available, otherwise use main gainNode
        const gainNode = insert.muteGain || insert.gainNode;
        if (gainNode) {
            gainNode.gain.setTargetAtTime(targetGain, now, 0.01);
        }
    }

    // =================== TRACK SOLO ===================

    /**
     * Set track solo state (handles cross-track muting)
     * @param {string} trackId - Mixer track ID
     * @param {boolean} solo - Solo state
     */
    static async setTrackSolo(trackId, solo) {
        const engine = this._getEngine();
        if (!engine) return;

        try {
            const { useMixerStore } = await import('@/store/useMixerStore');
            const tracks = useMixerStore.getState().mixerTracks;

            // Get all soloed tracks
            const soloedTracks = tracks.filter(t => t.solo || (t.id === trackId && solo));
            const hasSoloedTracks = soloedTracks.length > 0;

            const now = engine.audioContext.currentTime;

            // Update all tracks
            tracks.forEach(track => {
                const insert = engine.mixerInserts?.get(track.id);
                if (!insert) return;

                const gainNode = insert.muteGain || insert.gainNode;
                if (!gainNode) return;

                let targetGain = 1;

                if (hasSoloedTracks) {
                    // If there are soloed tracks, mute all non-soloed tracks
                    const isThisTrackSoloed = track.id === trackId ? solo : track.solo;
                    targetGain = (isThisTrackSoloed || track.muted) ? 1 : 0;
                } else {
                    // No solo, respect mute only
                    targetGain = track.muted ? 0 : 1;
                }

                gainNode.gain.setTargetAtTime(targetGain, now, 0.01);
            });
        } catch (error) {
            console.error('MixerService: Failed to set track solo:', error);
        }
    }

    // =================== SEND LEVELS ===================

    /**
     * Set send level (direct AudioParam manipulation)
     * @param {string} trackId - Source track ID
     * @param {string} sendId - Send bus ID (e.g., 'send1', 'send2')
     * @param {number} level - Send level (0 to 1)
     */
    static setSendLevel(trackId, sendId, level) {
        const engine = this._getEngine();
        if (!engine) return;

        const insert = engine.mixerInserts?.get(trackId);
        if (!insert?.sendGains) return;

        const sendGain = insert.sendGains.get(sendId);
        if (!sendGain) return;

        const clampedLevel = Math.max(0, Math.min(1, level));
        const now = engine.audioContext.currentTime;

        sendGain.gain.setTargetAtTime(clampedLevel, now, 0.01);
    }

    // =================== EFFECT BYPASS ===================

    /**
     * Set effect bypass state (direct audio routing)
     * @param {string} trackId - Mixer track ID
     * @param {string} effectId - Effect ID
     * @param {boolean} bypassed - Bypass state
     */
    static setEffectBypass(trackId, effectId, bypassed) {
        const engine = this._getEngine();
        if (!engine) return;

        const insert = engine.mixerInserts?.get(trackId);
        if (!insert) return;

        try {
            insert.setEffectBypass(effectId, bypassed);
        } catch (error) {
            console.error(`MixerService: Failed to set effect bypass for ${effectId}:`, error);
        }
    }

    /**
     * Set master volume
     * @param {number} linearGain - Volume as linear gain (0 to 1)
     */
    static setMasterVolume(linearGain) {
        const engine = this._getEngine();
        if (!engine?.setMasterVolume) return;

        // Clamp to valid range
        const clampedGain = Math.max(0, Math.min(1, linearGain));
        engine.setMasterVolume(clampedGain);
    }

    /**
     * Set master pan
     * @param {number} pan - Pan value (-1 to +1)
     */
    static setMasterPan(pan) {
        const engine = this._getEngine();
        if (!engine?.setMasterPan) return;

        const clampedPan = Math.max(-1, Math.min(1, pan));
        engine.setMasterPan(clampedPan);
    }

    // =================== UTILITY METHODS ===================

    /**
     * Get mixer insert for a track
     * @param {string} trackId - Track ID
     * @returns {MixerInsert|null}
     */
    static getMixerInsert(trackId) {
        const engine = this._getEngine();
        return engine?.mixerInserts?.get(trackId) || null;
    }

    /**
     * Get analyzer node for a track (for level meters)
     * @param {string} trackId - Track ID
     * @returns {AnalyserNode|null}
     */
    static getAnalyzer(trackId) {
        const insert = this.getMixerInsert(trackId);
        return insert?.getAnalyzer ? insert.getAnalyzer() : (insert?._analyzer || null);
    }

    // =================== LEGACY COMPATIBILITY ===================

    /**
     * Set track gain (linear) - legacy method
     * @param {string} trackId - Track ID
     * @param {number} linearGain - Linear gain (0 to 1+)
     * @deprecated Use setTrackVolume(trackId, db) instead
     */
    static setInsertGain(trackId, linearGain) {
        const db = linearGain === 0 ? -Infinity : 20 * Math.log10(linearGain);
        this.setTrackVolume(trackId, db);
    }

    /**
     * Set track pan - legacy method
     * @param {string} trackId - Track ID
     * @param {number} pan - Pan value
     * @deprecated Use setTrackPan(trackId, pan) instead
     */
    static setInsertPan(trackId, pan) {
        this.setTrackPan(trackId, pan);
    }

    // =================== MIXER INSERT MANAGEMENT ===================

    /**
     * Create a new mixer insert
     * @param {string} trackId - Track ID
     * @param {string} label - Track label
     * @returns {MixerInsert|null}
     */
    static createMixerInsert(trackId, label = '') {
        const engine = this._getEngine();
        if (!engine?.createMixerInsert) return null;
        return engine.createMixerInsert(trackId, label);
    }

    /**
     * Remove a mixer insert
     * @param {string} trackId - Track ID
     */
    static removeMixerInsert(trackId) {
        const engine = this._getEngine();
        if (engine?.removeMixerInsert) {
            engine.removeMixerInsert(trackId);
        }
    }

    // =================== MUTE/SOLO/MONO STATE ===================

    /**
     * Set track mute state directly on audio engine
     * @param {string} trackId - Track ID
     * @param {boolean} muted - Muted state
     */
    static setMuteState(trackId, muted) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const insert = engine.mixerInserts.get(trackId);
        if (insert?.setMute) {
            insert.setMute(muted);
        }
    }

    /**
     * Set solo state for multiple tracks
     * @param {Set<string>} soloedChannels - Set of soloed channel IDs
     * @param {Set<string>} mutedChannels - Set of muted channel IDs
     */
    static setSoloState(soloedChannels, mutedChannels = new Set()) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const hasSoloed = soloedChannels.size > 0;
        const now = engine.audioContext?.currentTime || 0;

        for (const [trackId, insert] of engine.mixerInserts) {
            if (!insert?.gainNode) continue;

            const isSoloed = soloedChannels.has(trackId);
            const isMuted = mutedChannels.has(trackId);

            // If any track is soloed, mute non-soloed tracks
            let targetGain = 1;
            if (hasSoloed && !isSoloed) {
                targetGain = 0;
            } else if (isMuted) {
                targetGain = 0;
            }

            const gainNode = insert.muteGain || insert.gainNode;
            if (gainNode?.gain) {
                gainNode.gain.setTargetAtTime(targetGain, now, 0.01);
            }
        }
    }

    /**
     * Set mono state for a track
     * @param {string} trackId - Track ID
     * @param {boolean} mono - Mono state
     */
    static setMonoState(trackId, mono) {
        const engine = this._getEngine();
        if (!engine?.mixerInserts) return;

        const insert = engine.mixerInserts.get(trackId);
        if (insert?.setMono) {
            insert.setMono(mono);
        }
    }

    /**
     * Update mixer parameter (generic)
     * @param {string} trackId - Track ID
     * @param {string} param - Parameter name
     * @param {*} value - Parameter value
     */
    static updateMixerParam(trackId, param, value) {
        switch (param) {
            case 'volume':
                this.setTrackVolume(trackId, value);
                break;
            case 'pan':
                this.setTrackPan(trackId, value);
                break;
            case 'mute':
            case 'muted':
            case 'isMuted':
                this.setTrackMute(trackId, value);
                break;
            default:
                console.warn(`MixerService: Unknown parameter "${param}"`);
        }
    }
}
