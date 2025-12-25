/**
 * AI Instrument Manager
 * 
 * AI enstrümanlarını projeye entegre eder
 */

import { v4 as uuidv4 } from 'uuid';
import { aiInstrumentService } from './AIInstrumentService';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { InstrumentService } from '@/lib/services/InstrumentService';
import { useArrangementStore } from '@/store/useArrangementStore';

export class AIInstrumentManager {
  /**
   * Create AI instrument from prompt
   */
  async createAIInstrument(prompt, options = {}) {
    const {
      variationIndex = 0,
      provider = 'elevenlabs',
      duration = 5,
      apiKey = null,
      preGeneratedResult = null // ✅ NEW: Allow passing already generated result
    } = options;

    try {
      // Use pre-generated result if available, otherwise generate
      const result = preGeneratedResult || await aiInstrumentService.generateInstrument(prompt, {
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
      const instrumentId = `ai-inst-${uuidv4()}`;

      // ✅ PERSISTENCE FIX: Create Data URL for the sample
      // This ensures the instrument can be restored/reloaded even if audioBuffer is lost
      // and matches the project's standard sample usage (which relies on .url)
      let audioUrl = null;
      if (selectedVariation.audioData) {
        audioUrl = `data:audio/mpeg;base64,${selectedVariation.audioData}`;
      }

      const instrumentData = {
        id: instrumentId,
        name: this.generateInstrumentName(prompt),
        type: 'ai-generated',
        audioBuffer: selectedVariation.audioBuffer,
        url: audioUrl, // ✅ Assign standard URL property
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

      // Format instrument data for handleAddNewInstrument
      // Format instrument data for handleAddNewInstrument
      const formattedInstrumentData = {
        id: instrumentData.id,
        name: instrumentData.name,
        type: 'sample', // AI-generated instruments are treated as samples
        audioBuffer: instrumentData.audioBuffer,
        url: instrumentData.url, // ✅ Pass URL to store
        aiMetadata: instrumentData.aiMetadata
      };

      instrumentsStore.handleAddNewInstrument(formattedInstrumentData);

      // Add to first pattern if it exists
      this.addToFirstPattern(instrumentData.id);

      return formattedInstrumentData;
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
      const { patterns, patternOrder, createPattern } = useArrangementStore.getState();

      if (patternOrder.length === 0) {
        // Create first pattern if it doesn't exist
        createPattern('Pattern 1');
      }

      const firstPatternId = patternOrder.length > 0
        ? patternOrder[0]
        : useArrangementStore.getState().patternOrder[0];

      if (firstPatternId) {
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
      let audioUrl = null;
      if (result.variations[0].audioData) {
        audioUrl = `data:audio/mpeg;base64,${result.variations[0].audioData}`;
      }

      const updatedInstrument = {
        ...instrument,
        audioBuffer: result.variations[0].audioBuffer,
        url: audioUrl, // ✅ Update URL
        aiMetadata: {
          ...aiMetadata,
          selectedPrompt: variation.prompt,
          variationId: variation.id
        }
      };

      // Update in store
      instrumentsStore.updateInstrument(instrumentId, updatedInstrument);

      // Update audio engine
      // Note: updateInstrument needs buffer sync - reconcile handles this
      InstrumentService.reconcile(instrumentId, updatedInstrument);

      return updatedInstrument;
    } catch (error) {
      console.error('❌ Failed to switch variation:', error);
      throw error;
    }
  }
}

export const aiInstrumentManager = new AIInstrumentManager();

