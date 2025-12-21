import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { coProducerService, ProjectContext } from '../services/CoProducerService.js';
import { logger } from '../utils/logger.js';

export async function coProducerRoutes(server: FastifyInstance) {
    /**
     * POST /api/co-producer/suggestions
     * Returns ranked library matches based on project context
     */
    server.post('/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const context = request.body as ProjectContext;
            const suggestions = await coProducerService.getSuggestions(context);
            return { suggestions };
        } catch (error) {
            logger.error('❌ Co-Producer suggestions failed:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    /**
     * POST /api/co-producer/generate
     * Triggers AI audio generation based on prompt and context
     */
    server.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { prompt, context } = request.body as { prompt: string, context: ProjectContext };
            const result = await coProducerService.generateVariation(prompt, context);
            return result;
        } catch (error) {
            logger.error('❌ Co-Producer generation failed:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    /**
     * GET /api/co-producer/status
     * Simple health check for the AI service
     */
    server.get('/status', async () => {
        return { status: 'online', service: 'Co-Producer AI Orchestrator' };
    });
}
