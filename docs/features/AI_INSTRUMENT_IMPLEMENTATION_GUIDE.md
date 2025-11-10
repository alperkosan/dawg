# AI Instrument Implementation Guide

## 🎯 Quick Start

Bu rehber, yapay zeka tabanlı enstrüman sisteminin implementasyonu için adım adım talimatlar içermektedir.

---

## 📦 1. Dependencies & Setup

### Required Packages

```bash
npm install axios form-data
```

### Environment Variables

```env
# .env
STABILITY_AI_API_KEY=your_api_key_here
STABILITY_AI_API_URL=https://api.stability.ai/v2beta/audio-generation

# Optional: Self-hosted AudioCraft
AUDIOCRAFT_API_URL=http://localhost:8000/api/generate

# Optional: Mubert API
MUBERT_API_KEY=your_mubert_key_here
MUBERT_API_URL=https://api-b2b.mubert.com/v2
```

---

## 🔧 2. Core Implementation

### 2.1 AI Instrument Service

```javascript
// src/lib/ai/AIInstrumentService.js
import { StabilityAIProvider } from './providers/StabilityAIProvider.js';
import { AudioCraftProvider } from './providers/AudioCraftProvider.js';
import { MubertProvider } from './providers/MubertProvider.js';

export class AIInstrumentService {
  constructor() {
    this.providers = {
      'stability-ai': new StabilityAIProvider(),
      'audiocraft': new AudioCraftProvider(),
      'mubert': new MubertProvider()
    };
    
    this.cache = new Map();
    this.defaultProvider = 'stability-ai';
  }

  /**
   * Generate instrument audio from text prompt
   */
  async generateInstrument(prompt, options = {}) {
    const {
      provider = this.defaultProvider,
      variations = 3,
      duration = 5,
      apiKey = null
    } = options;

    // Check cache
    const cacheKey = this.getCacheKey(provider, prompt, duration);
    if (this.cache.has(cacheKey)) {
      console.log('✅ Using cached audio');
      return this.cache.get(cacheKey);
    }

    try {
      // Generate variation prompts
      const variationPrompts = this.generateVariations(prompt, variations);
      
      // Generate audio for each variation
      const audioBuffers = await Promise.all(
        variationPrompts.map((variationPrompt, index) => 
          this.generateSingleVariation(variationPrompt, {
            provider,
            duration,
            apiKey,
            variationIndex: index
          })
        )
      );

      // Create result object
      const result = {
        originalPrompt: prompt,
        variations: audioBuffers.map((buffer, i) => ({
          id: `var-${i + 1}`,
          audioBuffer: buffer,
          prompt: variationPrompts[i],
          duration: buffer.duration
        })),
        provider,
        cached: false,
        timestamp: Date.now()
      };

      // Cache result
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('❌ AI Instrument generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a single variation
   */
  async generateSingleVariation(prompt, options) {
    const { provider, duration, apiKey, variationIndex } = options;
    
    try {
      const providerInstance = this.providers[provider];
      if (!providerInstance) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const audioBuffer = await providerInstance.generate(prompt, {
        duration,
        apiKey
      });

      return audioBuffer;
    } catch (error) {
      console.error(`❌ Variation ${variationIndex} generation failed:`, error);
      // Try fallback provider
      if (provider !== 'stability-ai') {
        return this.generateSingleVariation(prompt, {
          ...options,
          provider: 'stability-ai'
        });
      }
      throw error;
    }
  }

  /**
   * Generate variation prompts from base prompt
   */
  generateVariations(basePrompt, count) {
    const modifiers = [
      "with more reverb and depth",
      "with delay and spatial effects",
      "brighter and more crisp",
      "darker and more mellow",
      "with light distortion",
      "with compression and punch",
      "softer attack, longer decay",
      "more aggressive and punchy"
    ];

    const variations = [basePrompt]; // Original as first variation
    
    for (let i = 1; i < count; i++) {
      const modifier = modifiers[(i - 1) % modifiers.length];
      variations.push(`${basePrompt}, ${modifier}`);
    }

    return variations;
  }

  /**
   * Get cache key for prompt
   */
  getCacheKey(provider, prompt, duration) {
    return `${provider}:${prompt.toLowerCase()}:${duration}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.cache.size;
  }
}

// Singleton instance
export const aiInstrumentService = new AIInstrumentService();
```

### 2.2 Stability AI Provider

```javascript
// src/lib/ai/providers/StabilityAIProvider.js
export class StabilityAIProvider {
  constructor() {
    this.baseURL = process.env.STABILITY_AI_API_URL || 
                   'https://api.stability.ai/v2beta/audio-generation';
    this.defaultModel = 'stable-audio-open-1.0';
    this.timeout = 60000; // 60 seconds
  }

  async generate(prompt, options = {}) {
    const {
      duration = 5,
      apiKey = process.env.STABILITY_AI_API_KEY,
      model = this.defaultModel
    } = options;

    if (!apiKey) {
      throw new Error('Stability AI API key is required');
    }

    try {
      console.log(`🎵 Generating audio with Stable Audio: "${prompt}"`);

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'audio/*'
        },
        body: JSON.stringify({
          prompt: prompt,
          output_format: 'wav',
          duration: Math.min(duration, 10), // Max 10 seconds
          model: model
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Stability AI API Error: ${response.status} ${response.statusText}\n` +
          JSON.stringify(errorData, null, 2)
        );
      }

      // Get audio blob
      const audioBlob = await response.blob();
      
      // Convert to AudioBuffer
      const audioBuffer = await this.decodeAudioData(audioBlob);

      console.log(`✅ Audio generated: ${audioBuffer.duration.toFixed(2)}s`);

      return audioBuffer;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Audio generation took too long');
      }
      console.error('❌ Stability AI generation failed:', error);
      throw error;
    }
  }

  async decodeAudioData(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  }
}
```

### 2.3 Project Analyzer

```javascript
// src/lib/ai/ProjectAnalyzer.js
export class ProjectAnalyzer {
  /**
   * Analyze current project and suggest AI instruments
   */
  analyzeProject(projectState) {
    const { patterns, instruments, arrangement } = projectState;

    // Analyze existing instruments
    const analysis = {
      instrumentTypes: this.analyzeInstrumentTypes(instruments),
      genres: this.detectGenres(patterns, instruments),
      tempo: this.detectTempo(arrangement),
      key: this.detectKey(patterns),
      density: this.analyzeDensity(patterns),
      frequencyRange: this.analyzeFrequencyRange(instruments)
    };

    // Generate suggestions
    const suggestions = this.generateSuggestions(analysis);

    return {
      analysis,
      suggestions
    };
  }

  /**
   * Analyze instrument types in project
   */
  analyzeInstrumentTypes(instruments) {
    const types = {
      drums: [],
      bass: [],
      leads: [],
      pads: [],
      percussion: [],
      other: []
    };

    instruments.forEach(instrument => {
      const name = instrument.name.toLowerCase();
      
      if (this.isDrums(name)) types.drums.push(instrument.id);
      else if (this.isBass(name)) types.bass.push(instrument.id);
      else if (this.isLead(name)) types.leads.push(instrument.id);
      else if (this.isPad(name)) types.pads.push(instrument.id);
      else if (this.isPercussion(name)) types.percussion.push(instrument.id);
      else types.other.push(instrument.id);
    });

    return types;
  }

  /**
   * Detect genre from patterns and instruments
   */
  detectGenres(patterns, instruments) {
    const genres = [];
    const instrumentNames = instruments.map(i => i.name.toLowerCase()).join(' ');

    // Genre detection based on instrument names and patterns
    if (instrumentNames.includes('kick') && instrumentNames.includes('808')) {
      genres.push('hip-hop', 'trap');
    }
    if (instrumentNames.includes('house') || instrumentNames.includes('four-on-the-floor')) {
      genres.push('house');
    }
    if (instrumentNames.includes('techno') || instrumentNames.includes('acid')) {
      genres.push('techno');
    }
    if (instrumentNames.includes('ambient') || instrumentNames.includes('pad')) {
      genres.push('ambient');
    }

    return genres.length > 0 ? genres : ['electronic'];
  }

  /**
   * Detect tempo from arrangement
   */
  detectTempo(arrangement) {
    return arrangement?.tempo || 120; // Default 120 BPM
  }

  /**
   * Detect key from patterns
   */
  detectKey(patterns) {
    // Simple key detection (can be enhanced)
    return 'C'; // Default to C major
  }

  /**
   * Analyze pattern density
   */
  analyzeDensity(patterns) {
    // Calculate average notes per pattern
    const totalNotes = Object.values(patterns).reduce((sum, pattern) => {
      const patternNotes = Object.values(pattern.data || {}).flat();
      return sum + patternNotes.length;
    }, 0);
    
    const patternCount = Object.keys(patterns).length;
    return patternCount > 0 ? totalNotes / patternCount : 0;
  }

  /**
   * Analyze frequency range
   */
  analyzeFrequencyRange(instruments) {
    // Simple frequency range analysis
    return {
      low: instruments.some(i => this.isBass(i.name)),
      mid: instruments.some(i => this.isLead(i.name) || this.isPad(i.name)),
      high: instruments.some(i => this.isPercussion(i.name))
    };
  }

  /**
   * Generate suggestions based on analysis
   */
  generateSuggestions(analysis) {
    const suggestions = [];

    // Bass suggestions
    if (analysis.instrumentTypes.bass.length === 0) {
      suggestions.push({
        type: 'bass',
        priority: 'high',
        prompts: [
          "deep analog bass synth",
          "warm sub bass with reverb",
          "punchy 808 bass",
          "growling bass with distortion"
        ],
        reason: "No bass instruments detected"
      });
    }

    // Lead suggestions
    if (analysis.instrumentTypes.leads.length === 0) {
      suggestions.push({
        type: 'lead',
        priority: 'medium',
        prompts: [
          "bright lead synth",
          "warm pad sound",
          "pluck lead with delay",
          "arpeggiated lead"
        ],
        reason: "No lead instruments detected"
      });
    }

    // Genre-based suggestions
    if (analysis.genres.includes('house')) {
      suggestions.push({
        type: 'percussion',
        priority: 'medium',
        prompts: [
          "house kick drum",
          "shaker pattern",
          "hi-hat pattern",
          "clap with reverb"
        ],
        reason: "House genre detected"
      });
    }

    // Frequency range suggestions
    if (!analysis.frequencyRange.low) {
      suggestions.push({
        type: 'bass',
        priority: 'high',
        prompts: [
          "deep low-end bass",
          "sub bass",
          "808 kick"
        ],
        reason: "Missing low frequencies"
      });
    }

    if (!analysis.frequencyRange.high) {
      suggestions.push({
        type: 'percussion',
        priority: 'low',
        prompts: [
          "bright hi-hat",
          "shaker",
          "tambourine"
        ],
        reason: "Missing high frequencies"
      });
    }

    return suggestions;
  }

  // Helper methods
  isDrums(name) {
    return /kick|snare|drum|hat|hihat|crash|ride|tom|perc/.test(name);
  }

  isBass(name) {
    return /bass|808|sub|low/.test(name);
  }

  isLead(name) {
    return /lead|synth|pluck|arpeggio/.test(name);
  }

  isPad(name) {
    return /pad|ambient|atmosphere|string/.test(name);
  }

  isPercussion(name) {
    return /shaker|tambourine|clap|snap/.test(name);
  }
}

export const projectAnalyzer = new ProjectAnalyzer();
```

### 2.4 AI Instrument Store Integration

```javascript
// src/lib/ai/AIInstrumentManager.js
import { aiInstrumentService } from './AIInstrumentService.js';
import { useInstrumentsStore } from '@/store/useInstrumentsStore.js';
import { AudioContextService } from '@/lib/services/AudioContextService.js';
import { PatternService } from '@/lib/services/PatternService.js';

export class AIInstrumentManager {
  /**
   * Create AI instrument from prompt
   */
  async createAIInstrument(prompt, options = {}) {
    const {
      variationIndex = 0,
      provider = 'stability-ai',
      duration = 5,
      apiKey = null
    } = options;

    try {
      // Generate audio
      const result = await aiInstrumentService.generateInstrument(prompt, {
        provider,
        variations: 3,
        duration,
        apiKey
      });

      // Select variation
      const selectedVariation = result.variations[variationIndex];
      if (!selectedVariation) {
        throw new Error('Selected variation not found');
      }

      // Create instrument data
      const instrumentData = {
        name: this.generateInstrumentName(prompt),
        type: 'ai-generated',
        audioBuffer: selectedVariation.audioBuffer,
        aiMetadata: {
          provider,
          originalPrompt: prompt,
          selectedPrompt: selectedVariation.prompt,
          variationId: selectedVariation.id,
          allVariations: result.variations.map(v => ({
            id: v.id,
            prompt: v.prompt
          })),
          duration: selectedVariation.duration,
          timestamp: result.timestamp
        }
      };

      // Add to instruments store
      const instrumentsStore = useInstrumentsStore.getState();
      instrumentsStore.handleAddNewInstrument(instrumentData);

      // Add to first pattern if it exists
      this.addToFirstPattern(instrumentData.id);

      return instrumentData;
    } catch (error) {
      console.error('❌ Failed to create AI instrument:', error);
      throw error;
    }
  }

  /**
   * Generate instrument name from prompt
   */
  generateInstrumentName(prompt) {
    // Extract key words from prompt
    const words = prompt.toLowerCase().split(/\s+/);
    const keyWords = words.filter(word => 
      !['a', 'an', 'the', 'with', 'and', 'or', 'for', 'to'].includes(word)
    );
    
    // Capitalize first letter of each word
    const name = keyWords
      .slice(0, 3) // Take first 3 words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return name || 'AI Instrument';
  }

  /**
   * Add instrument to first pattern
   */
  addToFirstPattern(instrumentId) {
    try {
      const { patterns, patternOrder } = useArrangementStore.getState();
      
      if (patternOrder.length === 0) {
        // Create first pattern if it doesn't exist
        PatternService.createNewPattern('Pattern 1', 64);
      }

      const firstPatternId = patternOrder[0];
      const pattern = patterns[firstPatternId];

      if (pattern) {
        // Instrument is automatically added to pattern via handleAddNewInstrument
        console.log(`✅ Added AI instrument to pattern: ${firstPatternId}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not add instrument to pattern:', error);
    }
  }

  /**
   * Switch variation for AI instrument
   */
  async switchVariation(instrumentId, variationId) {
    try {
      const instrumentsStore = useInstrumentsStore.getState();
      const instrument = instrumentsStore.instruments.find(i => i.id === instrumentId);

      if (!instrument || instrument.type !== 'ai-generated') {
        throw new Error('Instrument not found or not an AI instrument');
      }

      const { aiMetadata } = instrument;
      const variation = aiMetadata.allVariations.find(v => v.id === variationId);

      if (!variation) {
        throw new Error('Variation not found');
      }

      // Regenerate audio for selected variation (or use cache)
      const result = await aiInstrumentService.generateInstrument(
        variation.prompt,
        {
          provider: aiMetadata.provider,
          variations: 1,
          duration: aiMetadata.duration
        }
      );

      // Update instrument
      const updatedInstrument = {
        ...instrument,
        audioBuffer: result.variations[0].audioBuffer,
        aiMetadata: {
          ...aiMetadata,
          selectedPrompt: variation.prompt,
          variationId: variation.id
        }
      };

      // Update in store
      instrumentsStore.updateInstrument(instrumentId, updatedInstrument);

      // Update audio engine
      AudioContextService.updateInstrument(updatedInstrument);

      return updatedInstrument;
    } catch (error) {
      console.error('❌ Failed to switch variation:', error);
      throw error;
    }
  }
}

export const aiInstrumentManager = new AIInstrumentManager();
```

---

## 🎨 3. UI Components

### 3.1 AI Instrument Panel

```jsx
// src/components/ai/AIInstrumentPanel.jsx
import React, { useState } from 'react';
import { aiInstrumentManager } from '@/lib/ai/AIInstrumentManager.js';
import { projectAnalyzer } from '@/lib/ai/ProjectAnalyzer.js';
import { useArrangementStore } from '@/store/useArrangementStore.js';
import { useInstrumentsStore } from '@/store/useInstrumentsStore.js';

export function AIInstrumentPanel() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [error, setError] = useState(null);

  const { patterns, instruments } = useArrangementStore();
  const instrumentsList = useInstrumentsStore(state => state.instruments);

  // Get project suggestions
  const projectState = { patterns, instruments: instrumentsList };
  const { suggestions } = projectAnalyzer.analyzeProject(projectState);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await aiInstrumentManager.createAIInstrument(prompt, {
        variationIndex: selectedVariation
      });

      setVariations(result.aiMetadata.allVariations);
      setPrompt(''); // Clear prompt
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestionPrompt) => {
    setPrompt(suggestionPrompt);
  };

  return (
    <div className="ai-instrument-panel">
      <div className="ai-panel-header">
        <h2>AI Instrument Generator</h2>
        <p>Describe the sound you want, and AI will generate it for you</p>
      </div>

      <div className="ai-prompt-input">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g., deep 808 kick drum, bright lead synth, warm pad..."
          disabled={loading}
        />
        <button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
          className="generate-button"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="ai-error">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="ai-suggestions">
          <h3>Suggested Instruments</h3>
          <div className="suggestions-grid">
            {suggestions.map((suggestion, i) => (
              <div key={i} className="suggestion-card">
                <div className="suggestion-header">
                  <span className="suggestion-type">{suggestion.type}</span>
                  <span className="suggestion-priority">{suggestion.priority}</span>
                </div>
                <p className="suggestion-reason">{suggestion.reason}</p>
                <div className="suggestion-prompts">
                  {suggestion.prompts.slice(0, 2).map((prompt, j) => (
                    <button
                      key={j}
                      onClick={() => handleSuggestionClick(prompt)}
                      className="suggestion-prompt-button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {variations.length > 0 && (
        <div className="ai-variations">
          <h3>Variations</h3>
          <div className="variations-grid">
            {variations.map((variation, i) => (
              <VariationCard
                key={variation.id}
                variation={variation}
                selected={i === selectedVariation}
                onSelect={() => setSelectedVariation(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VariationCard({ variation, selected, onSelect }) {
  return (
    <div 
      className={`variation-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="variation-header">
        <span>Variation {variation.id}</span>
      </div>
      <p className="variation-prompt">{variation.prompt}</p>
      <div className="variation-actions">
        <button onClick={(e) => {
          e.stopPropagation();
          // Preview audio
        }}>
          Preview
        </button>
      </div>
    </div>
  );
}
```

---

## 🚀 4. Integration Steps

### Step 1: Add AI Instrument Type

```javascript
// src/lib/audio/instruments/AIInstrument.js
export class AIInstrument extends BaseInstrument {
  constructor(instrumentData, audioContext) {
    super(instrumentData, audioContext);
    this.type = 'ai-generated';
    this.audioBuffer = instrumentData.audioBuffer;
    this.aiMetadata = instrumentData.aiMetadata;
  }

  triggerNote(pitch, velocity, time, duration) {
    // Use audio buffer like sample instrument
    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;
    
    // Apply pitch shift
    const semitones = pitch - 60; // C4 as reference
    source.playbackRate.value = Math.pow(2, semitones / 12);
    
    // Apply velocity
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = velocity / 127;
    
    source.connect(gainNode);
    gainNode.connect(this.output);
    
    source.start(time);
    source.stop(time + (duration || this.audioBuffer.duration));
  }
}
```

### Step 2: Update Instrument Factory

```javascript
// src/lib/audio/instruments/InstrumentFactory.js
import { AIInstrument } from './AIInstrument.js';

export class InstrumentFactory {
  static createInstrument(instrumentData, audioContext) {
    if (instrumentData.type === 'ai-generated') {
      return new AIInstrument(instrumentData, audioContext);
    }
    // ... other instrument types
  }
}
```

### Step 3: Update Native Audio Engine

```javascript
// src/lib/core/NativeAudioEngine.js
import { AIInstrument } from '../audio/instruments/AIInstrument.js';

async createInstrument(instrumentData) {
  // ... existing code
  if (instrumentData.type === 'ai-generated') {
    instrument = new AIInstrument(instrumentData, this.audioContext);
  }
  // ... rest of code
}
```

---

## 📊 5. Testing

### Unit Tests

```javascript
// src/lib/ai/__tests__/AIInstrumentService.test.js
import { AIInstrumentService } from '../AIInstrumentService.js';

describe('AIInstrumentService', () => {
  let service;

  beforeEach(() => {
    service = new AIInstrumentService();
  });

  test('generates variations from prompt', () => {
    const variations = service.generateVariations('deep bass', 3);
    expect(variations).toHaveLength(3);
    expect(variations[0]).toBe('deep bass');
  });

  test('caches generated audio', async () => {
    const prompt = 'test prompt';
    const result1 = await service.generateInstrument(prompt);
    const result2 = await service.generateInstrument(prompt);
    
    expect(result2.cached).toBe(true);
  });
});
```

---

## 🔒 6. Security & Best Practices

### API Key Management

```javascript
// src/lib/ai/ApiKeyManager.js
export class ApiKeyManager {
  static encryptApiKey(apiKey) {
    // Encrypt API key before storage
    // Use browser's crypto API or a library
    return btoa(apiKey); // Simple base64 encoding (not secure, use proper encryption)
  }

  static decryptApiKey(encryptedKey) {
    return atob(encryptedKey);
  }

  static storeApiKey(provider, apiKey) {
    const encrypted = this.encryptApiKey(apiKey);
    localStorage.setItem(`ai_api_key_${provider}`, encrypted);
  }

  static getApiKey(provider) {
    const encrypted = localStorage.getItem(`ai_api_key_${provider}`);
    return encrypted ? this.decryptApiKey(encrypted) : null;
  }
}
```

### Rate Limiting

```javascript
// src/lib/ai/RateLimiter.js
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }

    this.requests.push(now);
  }
}
```

---

## 🎯 7. Next Steps

1. ✅ Implement core AIInstrumentService
2. ✅ Integrate Stability AI API
3. ✅ Create UI components
4. ✅ Add project analyzer
5. ✅ Implement caching
6. ✅ Add error handling
7. ✅ Test and optimize

---

**Son Güncelleme**: 2025-01-XX
**Versiyon**: 1.0

