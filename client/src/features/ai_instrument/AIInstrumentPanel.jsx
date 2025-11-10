/**
 * AI Instrument Panel
 * 
 * Yapay zeka tabanlı enstrüman üretim paneli
 * - Text-to-audio generation
 * - Preset browser
 * - Project analysis suggestions
 * - Variation selection
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { AIPresetBrowser } from './components/AIPresetBrowser';
import { ProjectAnalysisSuggestions } from './components/ProjectAnalysisSuggestions';
import { VariationSelector } from './components/VariationSelector';
import { aiInstrumentService } from '@/lib/ai/AIInstrumentService';
import { projectAnalyzer } from '@/lib/ai/ProjectAnalyzer';
import { aiInstrumentManager } from '@/lib/ai/AIInstrumentManager';
import './AIInstrumentPanel.css';

export function AIInstrumentPanel() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [activeTab, setActiveTab] = useState('generate'); // 'generate', 'presets', 'suggestions'
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [duration, setDuration] = useState(5);
  const [provider, setProvider] = useState('stability-ai');

  // Get project state for analysis
  const { patterns } = useArrangementStore();
  const instruments = useInstrumentsStore(state => state.instruments);

  // Project analysis
  const projectState = useMemo(() => ({ patterns, instruments }), [patterns, instruments]);
  const { analysis, suggestions } = useMemo(
    () => projectAnalyzer.analyzeProject(projectState),
    [projectState]
  );

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call when API key is available
      const result = await aiInstrumentService.generateInstrument(prompt, {
        variations: 3,
        duration,
        provider
      });

      setVariations(result.variations);
      setSelectedVariation(0);
    } catch (err) {
      setError(err.message || 'Failed to generate instrument');
      console.error('AI Instrument generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [prompt, duration, provider]);

  // Handle preset selection
  const handlePresetSelect = useCallback((presetPrompt) => {
    setPrompt(presetPrompt);
    setActiveTab('generate');
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(async (suggestionPrompt) => {
    setPrompt(suggestionPrompt);
    setActiveTab('generate');
    // Auto-generate on suggestion click
    setLoading(true);
    setError(null);
    try {
      const result = await aiInstrumentService.generateInstrument(suggestionPrompt, {
        variations: 3,
        duration,
        provider
      });
      setVariations(result.variations);
      setSelectedVariation(0);
    } catch (err) {
      setError(err.message || 'Failed to generate instrument');
    } finally {
      setLoading(false);
    }
  }, [duration, provider]);

  // Handle create instrument
  const handleCreateInstrument = useCallback(async () => {
    if (variations.length === 0 || !variations[selectedVariation]) {
      setError('Please generate variations first');
      return;
    }

    try {
      await aiInstrumentManager.createAIInstrument(prompt, {
        variationIndex: selectedVariation,
        provider,
        duration
      });
      
      // Reset state
      setPrompt('');
      setVariations([]);
      setSelectedVariation(0);
    } catch (err) {
      setError(err.message || 'Failed to create instrument');
    }
  }, [variations, selectedVariation, prompt, provider, duration]);

  // Handle key press
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && prompt.trim()) {
        e.preventDefault();
        handleGenerate();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [prompt, handleGenerate]);

  return (
    <div className="ai-instrument-panel">
      {/* Header */}
      <div className="ai-instrument-panel__header">
        <h2 className="ai-instrument-panel__title">
          <span className="ai-instrument-panel__icon">✨</span>
          AI Instrument Generator
        </h2>
        <p className="ai-instrument-panel__subtitle">
          Describe the sound you want, and AI will generate it for you
        </p>
      </div>

      {/* Tabs */}
      <div className="ai-instrument-panel__tabs">
        <button
          className={`ai-instrument-panel__tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate
        </button>
        <button
          className={`ai-instrument-panel__tab ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          Presets
        </button>
        <button
          className={`ai-instrument-panel__tab ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions
        </button>
      </div>

      {/* Content */}
      <div className="ai-instrument-panel__content">
        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="ai-instrument-panel__generate">
            {/* Prompt Input */}
            <div className="ai-instrument-panel__prompt-section">
              <label className="ai-instrument-panel__label">
                Describe your sound
              </label>
              <div className="ai-instrument-panel__prompt-input-wrapper">
                <textarea
                  className="ai-instrument-panel__prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., deep 808 kick drum, bright lead synth, warm pad..."
                  rows={3}
                  disabled={loading}
                />
                <div className="ai-instrument-panel__prompt-actions">
                  <button
                    className="ai-instrument-panel__generate-button"
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                  >
                    {loading ? (
                      <>
                        <span className="ai-instrument-panel__loading-spinner"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        Generate
                      </>
                    )}
                  </button>
                  <button
                    className="ai-instrument-panel__advanced-toggle"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? '▼' : '▶'} Advanced
                  </button>
                </div>
              </div>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="ai-instrument-panel__advanced">
                  <div className="ai-instrument-panel__advanced-row">
                    <label className="ai-instrument-panel__label">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="ai-instrument-panel__number-input"
                    />
                  </div>
                  <div className="ai-instrument-panel__advanced-row">
                    <label className="ai-instrument-panel__label">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="ai-instrument-panel__select"
                    >
                      <option value="stability-ai">Stable Audio</option>
                      <option value="audiocraft" disabled>AudioCraft (Coming Soon)</option>
                      <option value="mubert" disabled>Mubert (Coming Soon)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="ai-instrument-panel__error">
                <span className="ai-instrument-panel__error-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Variations */}
            {variations.length > 0 && (
              <div className="ai-instrument-panel__variations-section">
                <VariationSelector
                  variations={variations}
                  selectedIndex={selectedVariation}
                  onSelect={setSelectedVariation}
                />
                <button
                  className="ai-instrument-panel__create-button"
                  onClick={handleCreateInstrument}
                >
                  <span>➕</span>
                  Add to Project
                </button>
              </div>
            )}
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <AIPresetBrowser onSelect={handlePresetSelect} />
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <ProjectAnalysisSuggestions
            suggestions={suggestions}
            analysis={analysis}
            onSelect={handleSuggestionClick}
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="ai-instrument-panel__footer">
        <div className="ai-instrument-panel__info">
          <span className="ai-instrument-panel__info-icon">💡</span>
          <span>Tip: Use Ctrl+Enter to generate quickly</span>
        </div>
        {suggestions.length > 0 && activeTab === 'generate' && (
          <button
            className="ai-instrument-panel__suggestions-badge"
            onClick={() => setActiveTab('suggestions')}
          >
            {suggestions.length} suggestions available
          </button>
        )}
      </div>
    </div>
  );
}

