import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';

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
    async generateVariation(prompt: string, context: ProjectContext): Promise<any> {
        logger.info(`🎨 CoProducer: Generating variation for prompt: "${prompt}" with context: ${JSON.stringify(context)}`);

        // In a real implementation, we would call an external API here (e.g., Stability AI)
        // For now, we will simulate the generation delay and return a mock result
        // that the frontend can handle (similar to current AIInstrumentService mock)

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mock variations
        const variations = [
            { id: `var-server-${Date.now()}-1`, prompt: `${prompt} - Variation A`, duration: 4 },
            { id: `var-server-${Date.now()}-2`, prompt: `${prompt} - Variation B`, duration: 4 }
        ];

        return {
            originalPrompt: prompt,
            variations,
            mock: true,
            timestamp: Date.now()
        };
    }
};

