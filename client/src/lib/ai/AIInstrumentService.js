/**
 * AI Instrument Service
 * 
 * Yapay zeka tabanlı enstrüman üretim servisi
 * Mock data ile çalışır (API key gelene kadar)
 */
import { decodeAudioData } from '../utils/audioUtils';

export class AIInstrumentService {
  constructor() {
    this.cache = new Map();
    this.defaultProvider = 'elevenlabs'; // ✨ Set ElevenLabs as default
    this.mockMode = false; // ✨ Disable mock mode for real API
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

    if (this.mockMode) {
      // Mock data for testing
      return this.generateMockInstrument(prompt, variations, duration);
    }

    try {
      // ✅ Call backend for ElevenLabs generation
      // We use the co-producer generate endpoint which now supports ElevenLabs
      const response = await fetch('/api/co-producer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          context: { variations, duration, provider },
          options: { promptInfluence: options.promptInfluence }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const backendResult = await response.json();

      if (backendResult.mock) {
        const errorMsg = backendResult.serviceError || 'Backend fell back to mock data';
        console.warn(`⚠️ AI Service Fallback: ${errorMsg}`);

        // If we are NOT in mock mode, this is a real error we should show the user
        if (!this.mockMode) {
          throw new Error(`AI Generation Failed: ${errorMsg}`);
        }

        return this.generateMockInstrument(prompt, variations, duration);
      }

      // ✅ Decode base64 variations into AudioBuffers
      const processedVariations = await Promise.all(
        backendResult.variations.map(async (v) => {
          if (v.audioData) {
            try {
              // Robust base64 to ArrayBuffer conversion using fetch
              const dataUrl = `data:audio/mpeg;base64,${v.audioData}`;
              const response = await fetch(dataUrl);
              const arrayBuffer = await response.arrayBuffer();

              // Decode using central audioUtils (ensures global AudioContext usage)
              const audioBuffer = await decodeAudioData(arrayBuffer);

              return {
                ...v,
                audioBuffer
              };
            } catch (err) {
              console.error('❌ Failed to decode variation audio:', err);
              return v;
            }
          }
          return v;
        })
      );

      const result = {
        originalPrompt: prompt,
        variations: processedVariations,
        provider: backendResult.provider || provider,
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
   * Generate mock instrument (for testing without API)
   */
  async generateMockInstrument(prompt, variations, duration) {
    console.log('🎭 Generating mock instrument (API key not available yet)');

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate variation prompts
    const variationPrompts = this.generateVariations(prompt, variations);

    // Create mock AudioBuffers
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;

    const mockVariations = variationPrompts.map((variationPrompt, i) => {
      // Create silent audio buffer (will be replaced with real audio when API is available)
      const buffer = audioContext.createBuffer(2, length, sampleRate);

      // Add some noise for visualization
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = (Math.random() - 0.5) * 0.1;
        }
      }

      return {
        id: `var-${i + 1}`,
        audioBuffer: buffer,
        prompt: variationPrompt,
        duration: duration
      };
    });

    return {
      originalPrompt: prompt,
      variations: mockVariations,
      provider: 'stability-ai',
      cached: false,
      timestamp: Date.now(),
      mock: true
    };
  }

  /**
   * Generate a single variation (real API call)
   */
  async generateSingleVariation(prompt, options) {
    const { provider, duration, apiKey, variationIndex } = options;

    // TODO: Implement real API call when API key is available
    // For now, return mock data
    if (this.mockMode) {
      return this.generateMockInstrument(prompt, 1, duration).then(result =>
        result.variations[0].audioBuffer
      );
    }

    try {
      const providerInstance = this.getProvider(provider);
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
   * Get provider instance
   */
  getProvider(provider) {
    // TODO: Import and return provider instances
    return null;
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

  /**
   * Set mock mode
   */
  setMockMode(enabled) {
    this.mockMode = enabled;
  }
}

// Singleton instance
export const aiInstrumentService = new AIInstrumentService();

