import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    Search,
    RefreshCw,
    Download,
    Music,
    Zap,
    ChevronRight,
    Play,
    Plus,
    Loader2,
    Wand2,
    Sparkles
} from 'lucide-react';
import EventBus from '@/lib/core/EventBus';
import { aiInstrumentService } from '@/lib/ai/AIInstrumentService';
import { usePreviewPlayerStore } from '@/store/usePreviewPlayerStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { apiClient } from '@/services/api';
import { audioAnalysisService } from '@/lib/services/AudioAnalysisService';
import { decodeAudioData } from '@/lib/utils/audioUtils';
import './CoProducerPanel.css';

const CoProducerPanel = () => {
    const [analysis, setAnalysis] = useState({
        rms: 0,
        energy: 0,
        spectralCentroid: 0,
        peak: 0,
        detectedKey: '...',
        detectedBpm: 120
    });
    const [vibeHistory, setVibeHistory] = useState([]);
    const MAX_HISTORY = 40;

    const [isListening, setIsListening] = useState(true);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState([
        { id: 'suggest-1', name: 'Deep Tech Loop', type: 'Loop', tags: ['Deep', 'Ambient'], match: 94 },
        { id: 'suggest-2', name: 'Ethereal Pad', type: 'Preset', tags: ['Atmospheric', 'Soft'], match: 88 },
        { id: 'suggest-3', name: 'Impact Sub', type: 'One-Shot', tags: ['Bass', 'Power'], match: 82 }
    ]);

    const { playPreview, playingUrl } = usePreviewPlayerStore();
    const { addAudioClip } = useArrangementStore();
    const { userAssets, systemAssets } = useFileBrowserStore();
    const { currentStep, isPlaying } = usePlaybackStore();

    const [autoRefresh, setAutoRefresh] = useState(false);
    const lastVibeRef = useRef({ energy: 0, key: '' });

    // Handle Auto-Refresh logic
    useEffect(() => {
        if (!autoRefresh || !isPlaying) return;

        const energyDiff = Math.abs(analysis.energy - lastVibeRef.current.energy);
        const keyChanged = analysis.detectedKey !== lastVibeRef.current.key;

        if (energyDiff > 0.3 || (keyChanged && analysis.confidence > 0.7)) {
            console.log('🔄 Vibe shifted, auto-refreshing suggestions...');
            handleSearchLibrary();
            lastVibeRef.current = { energy: analysis.energy, key: analysis.detectedKey };
        }
    }, [analysis.energy, analysis.detectedKey, autoRefresh, isPlaying]);

    // Update analysis from EventBus
    useEffect(() => {
        const handleAnalysis = (features) => {
            setAnalysis(features);
            setVibeHistory(prev => [...prev, features.energy].slice(-MAX_HISTORY));
        };

        if (isListening) {
            audioAnalysisService.start();
            EventBus.on('AUDIO_ANALYSIS_FEATURES', handleAnalysis);
        }

        return () => {
            if (isListening) {
                audioAnalysisService.stop();
                EventBus.off('AUDIO_ANALYSIS_FEATURES', handleAnalysis);
            }
        };
    }, [isListening, MAX_HISTORY]);

    const visualizerBars = 20;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        try {
            const result = await apiClient.generateCoProducerVariation(prompt, {
                bpm: analysis.detectedBpm,
                key: analysis.detectedKey,
                energy: analysis.energy
            });

            // If the server returns mock variations (ids only), we still need to decode them 
            // OR if it's production audio, handle the URLs.
            // For now, since server returns mock metadata, we adapt it:
            // ✅ Decode ElevenLabs base64 audio if present
            const variations = await Promise.all(
                (result.variations || []).map(async (v) => {
                    if (v.audioData) {
                        try {
                            const dataUrl = `data:audio/mpeg;base64,${v.audioData}`;
                            const response = await fetch(dataUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            const audioBuffer = await decodeAudioData(arrayBuffer);
                            return { ...v, audioBuffer };
                        } catch (err) {
                            console.error('❌ Failed to decode suggestion audio:', err);
                            return v;
                        }
                    }
                    return v;
                })
            );

            const newSuggestions = variations.map(v => ({
                id: v.id,
                name: v.prompt || `AI Gen: ${prompt.slice(0, 10)}...`,
                type: 'AI Generation',
                match: 99,
                prompt: v.prompt,
                audioBuffer: v.audioBuffer
            }));

            setSuggestions(prev => [...newSuggestions, ...prev].slice(0, 10));
            setPrompt('');
        } catch (error) {
            console.error('❌ Server-side generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSearchLibrary = async () => {
        setIsGenerating(true);
        try {
            const result = await apiClient.getCoProducerSuggestions({
                bpm: analysis.detectedBpm,
                key: analysis.detectedKey,
                energy: analysis.energy,
                tags: [] // Can be extended with user prompt keywords
            });

            if (result.suggestions) {
                setSuggestions(prev => [
                    ...result.suggestions,
                    ...prev.filter(p => !p.isLibrary)
                ].slice(0, 10));
            }
        } catch (error) {
            console.error('❌ Server-side library search failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePreview = async (item) => {
        if (item.audioBuffer) {
            const blob = bufferToWaveBlob(item.audioBuffer);
            const url = URL.createObjectURL(blob);
            playPreview(url);
        } else if (item.url) {
            playPreview(item.url);
        }
    };

    const handleAddToProject = async (item) => {
        if (!item.audioBuffer && !item.url) return;

        let buffer = item.audioBuffer;

        if (!buffer && item.url) {
            try {
                const response = await fetch(item.url);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await decodeAudioData(arrayBuffer);
            } catch (error) {
                console.error('❌ Failed to load library sample for project:', error);
                return;
            }
        }

        addAudioClip({
            patternId: 'ai-gen',
            audioBuffer: buffer,
            name: item.name,
            startTime: currentStep
        });

        console.log('✅ Added to project:', item.name);
    };

    // Helper to convert AudioBuffer to WAV Blob
    const bufferToWaveBlob = (buffer) => {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferArr = new ArrayBuffer(length);
        const view = new DataView(bufferArr);
        const channels = [];
        let i;
        let sample;
        let offset = 0;
        let pos = 0;

        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };

        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        // Write WAV header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit (hardcoded)
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        for (i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([bufferArr], { type: 'audio/wav' });
    };

    const handleReimagine = async (item) => {
        if (isGenerating) return;

        // Take the item name or prompt and create a more detailed variation prompt
        // Incorporate current project context for better results
        const contextPrompt = `A variation of ${item.name} in the style of ${analysis.detectedKey || 'C'} major at ${Math.round(analysis.detectedBpm)} BPM, with ${analysis.energy > 0.6 ? 'high energy' : 'atmospheric'} textures`;

        setIsGenerating(true);
        try {
            const result = await apiClient.generateCoProducerVariation(contextPrompt, {
                bpm: analysis.detectedBpm,
                key: analysis.detectedKey,
                energy: analysis.energy
            });

            const newSuggestions = (result.variations || []).map((v, i) => ({
                id: v.id,
                name: `Re: ${item.name} (${i + 1})`,
                type: 'AI Variation',
                match: 99,
                prompt: v.prompt
            }));

            setSuggestions(prev => [...newSuggestions, ...prev].slice(0, 10));
        } catch (error) {
            console.error('❌ Server-side Re-imagine failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="co-producer-panel">
            {/* Header */}
            <header className="co-producer-header">
                <div className="flex items-center gap-2">
                    <div className="co-producer-icon">
                        <Wand2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white/90">Co-Producer</h2>
                        <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">AI Assistant</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={`action-btn ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        title="Auto-refresh based on vibe"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        className={`listen-toggle ${isListening ? 'active' : ''}`}
                        onClick={() => setIsListening(!isListening)}
                    >
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-bold">{isListening ? 'LISTENING' : 'IDLE'}</span>
                    </button>
                </div>
            </header>

            {/* Analysis Monitor */}
            <section className="analysis-monitor">
                <div className="monitor-label">Live Project Context</div>
                <div className="visualizer-container">
                    {Array.from({ length: visualizerBars }).map((_, i) => (
                        <motion.div
                            key={i}
                            className="v-bar"
                            animate={{
                                height: isListening ? `${20 + (analysis.energy * (30 + Math.random() * 50))}px` : '4px',
                                opacity: isListening ? 0.3 + (analysis.rms * 2) : 0.1
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            style={{
                                background: `linear-gradient(to top, var(--accent-purple), var(--accent-cyan))`
                            }}
                        />
                    ))}
                </div>
                <div className="stats-grid">
                    <div className="stat-item relative overflow-hidden">
                        <span className="stat-label">ENERGY TREND</span>
                        <div className="h-8 flex items-end gap-[1px] mt-1">
                            {vibeHistory.map((v, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-purple-500/40 rounded-t-[1px]"
                                    style={{ height: `${v * 80}%`, opacity: 0.3 + (i / MAX_HISTORY) * 0.7 }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">BRIGHTNESS</span>
                        <div className="stat-value">{Math.round(analysis.spectralCentroid)}</div>
                        <div className="stat-bar"><div style={{ width: `${Math.min(100, analysis.spectralCentroid / 5)}%` }} /></div>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">DETECTED KEY</span>
                        <div className="stat-value text-cyan-400">{analysis.detectedKey || 'SCANNING...'}</div>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">TEMP O (BPM)</span>
                        <div className="stat-value text-purple-400">{Math.round(analysis.detectedBpm)}</div>
                    </div>
                </div>
            </section>

            {/* AI Prompt Input */}
            <section className="prompt-section">
                <div className="prompt-input-wrapper">
                    <Search className="w-4 h-4 text-white/30" />
                    <input
                        type="text"
                        placeholder="Describe a sound or variation..."
                        className="prompt-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="generate-btn"
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                    >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    </motion.button>
                </div>
            </section>

            {/* Suggestions List */}
            <section className="suggestions-section">
                <div className="section-header">
                    <Music className="w-3.5 h-3.5" />
                    <span>SMART SUGGESTIONS</span>
                    <RefreshCw
                        className="w-3 h-3 ml-auto cursor-pointer hover:rotate-180 transition-transform duration-500"
                        onClick={handleSearchLibrary}
                    />
                </div>

                <div className="suggestions-list">
                    <AnimatePresence>
                        {suggestions.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="suggestion-card"
                            >
                                <div className="suggestion-match">{item.match}%</div>
                                <div className="suggestion-info">
                                    <div className="suggestion-name">{item.name}</div>
                                    <div className="suggestion-type">{item.type}</div>
                                </div>
                                <div className="suggestion-actions">
                                    <button
                                        className={`action-btn ${playingUrl === item.id ? 'active' : ''}`}
                                        onClick={() => handlePreview(item)}
                                        title="Preview"
                                    >
                                        <Play className="w-3 h-3" />
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={() => handleReimagine(item)}
                                        disabled={isGenerating}
                                        title="Re-imagine (New AI Variation)"
                                    >
                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                    </button>
                                    <button
                                        className="action-btn"
                                        onClick={() => handleAddToProject(item)}
                                        title="Add to Project"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </section>

            {/* Footer / Status */}
            <footer className="co-producer-footer">
                <div className="ai-status">
                    <div className="status-dot pulse" />
                    <span>Engine v1.0.2 - Ready</span>
                </div>
                <div className="footer-links">
                    <Download className="w-3 h-3 hover:text-white cursor-pointer" />
                </div>
            </footer>
        </div>
    );
};

export default CoProducerPanel;
