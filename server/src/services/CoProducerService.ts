import { ElevenLabsClient } from 'elevenlabs';
import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Initialize SDK Client
const elevenlabs = new ElevenLabsClient({
    apiKey: config.elevenlabsApiKey
});

export interface ProjectContext {
    bpm?: number;
    key?: string;
    energy?: number;
    spectralCentroid?: number;
    tags?: string[];
}

export const coProducerService = {
    /**
     * Get ranked suggestions from the library based on project context
     */
    async getSuggestions(context: ProjectContext): Promise<any[]> {
        const db = getDatabase();
        const { bpm, key, energy, tags = [] } = context;

        logger.info(`🤖 CoProducer: Searching suggestions for context: ${JSON.stringify(context)}`);

        // Weighted scoring logic in SQL:
        // 1. Key match (25 points)
        // 2. BPM match (15 points if within ±2 BPM, 5 points if within ±10 BPM)
        // 3. Tag match (10 points per matching tag)
        // 4. Energy match (simulated with 'energetic'/'chill' tags)

        let query = `
      SELECT 
        id, name, filename, storage_url, bpm, key_signature, tags,
        (
          (CASE WHEN LOWER(key_signature) = LOWER($1) THEN 25 ELSE 0 END) +
          (CASE 
            WHEN bpm IS NOT NULL AND ABS(bpm - $2) <= 2 THEN 15
            WHEN bpm IS NOT NULL AND ABS(bpm - $2) <= 10 THEN 5
            ELSE 0 
          END) +
          (SELECT COUNT(*) FROM unnest(tags) t WHERE t = ANY($3)) * 10
        ) as score
      FROM system_assets
      WHERE is_active = true
      ORDER BY score DESC, usage_count DESC
      LIMIT 10
    `;

        const searchTags = [...tags];
        if (energy && energy > 0.6) searchTags.push('energetic', 'dense', 'hard');
        if (energy && energy < 0.3) searchTags.push('ambient', 'chill', 'minimal');

        const result = await db.query(query, [key || '', bpm || 120, searchTags]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            type: 'Library Match',
            match: Math.min(99, row.score),
            url: row.storage_url,
            isLibrary: true,
            metadata: {
                bpm: row.bpm,
                key: row.key_signature,
                tags: row.tags
            }
        }));
    },

    /**
     * Generate a sound variation based on prompt and context
     */
    /**
     * Enhance the user prompt with quality keywords and project context
     */
    enhancePrompt(prompt: string, context: ProjectContext): string {
        let enhanced = prompt;

        // 1. Basic Turkish keyword enhancement
        const mapping: { [key: string]: string } = {
            'vokal': 'vocal',
            'kız çocuğu': 'girl',
            'çocuk': 'child',
            'koro': 'choir',
            'davul': 'drum',
            'bas': 'bass',
            'piyano': 'piano',
            'keman': 'violin'
        };

        Object.entries(mapping).forEach(([tr, en]) => {
            if (enhanced.toLowerCase().includes(tr)) {
                enhanced += `, ${en}`;
            }
        });

        // 2. Project Context Enrichment

        // BPM Context
        if (context.bpm) {
            const bpm = Math.round(context.bpm);
            const tempoType = bpm > 115 ? 'upbeat, dance' : (bpm < 90 ? 'slow, chill' : 'moderate');
            enhanced += `, ${tempoType} tempo around ${bpm}bpm`;
        }

        // Key/Scale Context
        if (context.key && context.key !== '...') {
            enhanced += `, tuned to ${context.key}`;
        }

        // Energy Context (Atmosphere)
        if (typeof context.energy === 'number') {
            const energy = context.energy;
            if (energy > 0.7) {
                enhanced += ', aggressive, bright timbre, impactful, punchy';
            } else if (energy < 0.3) {
                enhanced += ', atmospheric, cinematic, soft attack, long decay, ambient';
            } else {
                enhanced += ', balanced texture, musical';
            }
        }

        // 3. Global quality keywords
        if (!enhanced.toLowerCase().includes('high quality')) {
            enhanced += ', high quality, studio recording, professional audio, 44.1kHz';
        }

        return enhanced;
    },

    async generateVariation(prompt: string, context: ProjectContext, options: { promptInfluence?: number } = {}): Promise<any> {
        logger.info(`🎨 CoProducer: Generating variation for prompt: "${prompt}" (Context: ${JSON.stringify(context)})`);

        const apiKey = config.elevenlabsApiKey;
        if (!apiKey) {
            const error = new Error('ELEVENLABS_API_KEY is missing in config. Please ensure it is set in .env and server is restarted.');
            logger.warn(`⚠️ ${error.message}`);
            return this.generateMockVariation(prompt, error);
        }

        try {
            const enhancedPrompt = this.enhancePrompt(prompt, context);
            logger.info(`✨ Enhanced Prompt: "${enhancedPrompt}"`);

            // SDK Sound Generation (returns a stream)
            const audioStream = await elevenlabs.textToSoundEffects.convert({
                text: enhancedPrompt,
                duration_seconds: 5,
                prompt_influence: options.promptInfluence ?? 0.7
            });

            // Read stream into buffer
            const chunks: Buffer[] = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const base64Audio = buffer.toString('base64');

            // Return a single variation for now with the real audio
            return {
                originalPrompt: prompt,
                variations: [
                    {
                        id: `var-el-${Date.now()}`,
                        prompt: prompt,
                        duration: 5,
                        audioData: base64Audio, // Base64 encoded audio
                        format: 'mp3' // ElevenLabs typically returns MP3 or WAV depending on endpoint
                    }
                ],
                mock: false,
                timestamp: Date.now(),
                provider: 'elevenlabs'
            };

        } catch (error) {
            logger.error('❌ ElevenLabs generation failed:', error);
            // Fallback to mock so UI doesn't break
            return this.generateMockVariation(prompt, error);
        }
    },

    /**
     * Fallback mock generator
     */
    async generateMockVariation(prompt: string, error?: any): Promise<any> {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            originalPrompt: prompt,
            variations: [
                { id: `var-server-${Date.now()}-1`, prompt: `${prompt} - Variation A`, duration: 4 },
                { id: `var-server-${Date.now()}-2`, prompt: `${prompt} - Variation B`, duration: 4 }
            ],
            mock: true,
            timestamp: Date.now(),
            serviceError: error ? (error.message || String(error)) : 'Unknown error'
        };
    }
};

