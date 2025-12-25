/**
 * Preset routes
 * API endpoints for community preset library
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
    createPreset,
    findPresetById,
    updatePreset,
    deletePreset,
    listPresets,
    searchPresets,
    ratePreset,
    downloadPreset,
    getUserDownloads,
    isPresetOwner,
    getPopularPresets,
    getFeaturedPresets,
} from '../services/presets.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';

const CreatePresetSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    presetType: z.enum(['instrument', 'effect']),
    engineType: z.string().min(1).max(50),
    category: z.string().max(50).optional(),
    presetData: z.record(z.any()),
    tags: z.array(z.string()).max(10).optional(),
    genre: z.string().max(50).optional(),
    isPublic: z.boolean().optional(),
});

const UpdatePresetSchema = CreatePresetSchema.partial().omit({ presetType: true, engineType: true });

const RatePresetSchema = z.object({
    rating: z.number().int().min(1).max(5),
});

export async function presetRoutes(server: FastifyInstance) {
    // List presets with filters
    server.get('/', async (request: FastifyRequest) => {
        try {
            const query = request.query as {
                userId?: string;
                presetType?: 'instrument' | 'effect';
                engineType?: string;
                category?: string;
                tags?: string;
                genre?: string;
                search?: string;
                public?: string;
                featured?: string;
                page?: string;
                limit?: string;
                sortBy?: string;
                sortOrder?: string;
            };

            const result = await listPresets({
                userId: query.userId,
                presetType: query.presetType,
                engineType: query.engineType,
                category: query.category,
                tags: query.tags ? query.tags.split(',') : undefined,
                genre: query.genre,
                search: query.search,
                isPublic: query.public === 'true' ? true : query.public === 'false' ? false : undefined,
                isFeatured: query.featured === 'true' ? true : undefined,
                page: query.page ? parseInt(query.page, 10) : undefined,
                limit: query.limit ? parseInt(query.limit, 10) : undefined,
                sortBy: query.sortBy as any,
                sortOrder: query.sortOrder as 'asc' | 'desc',
            });

            return {
                presets: result.presets.map(p => ({
                    id: p.id,
                    userId: p.user_id,
                    userName: p.userName,
                    name: p.name,
                    description: p.description,
                    presetType: p.preset_type,
                    engineType: p.engine_type,
                    category: p.category,
                    tags: p.tags,
                    genre: p.genre,
                    downloadsCount: p.downloads_count,
                    ratingAvg: p.rating_avg,
                    ratingCount: p.rating_count,
                    isFeatured: p.is_featured,
                    createdAt: p.created_at,
                })),
                pagination: {
                    page: query.page ? parseInt(query.page, 10) : 1,
                    limit: query.limit ? parseInt(query.limit, 10) : 20,
                    total: result.total,
                    totalPages: Math.ceil(result.total / (query.limit ? parseInt(query.limit, 10) : 20)),
                },
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Create preset
    server.post('/', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const body = CreatePresetSchema.parse(request.body);

            const preset = await createPreset({
                userId: (request.user as any).userId,
                name: body.name,
                description: body.description,
                presetType: body.presetType,
                engineType: body.engineType,
                category: body.category,
                presetData: body.presetData,
                tags: body.tags,
                genre: body.genre,
                isPublic: body.isPublic,
            });

            reply.code(201);

            return {
                preset: {
                    id: preset.id,
                    userId: preset.user_id,
                    userName: preset.userName,
                    name: preset.name,
                    description: preset.description,
                    presetType: preset.preset_type,
                    engineType: preset.engine_type,
                    category: preset.category,
                    presetData: preset.preset_data,
                    tags: preset.tags,
                    genre: preset.genre,
                    downloadsCount: preset.downloads_count,
                    ratingAvg: preset.rating_avg,
                    ratingCount: preset.rating_count,
                    isPublic: preset.is_public,
                    createdAt: preset.created_at,
                },
            };
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                throw new BadRequestError(`Validation failed: ${details}`);
            }
            throw error;
        }
    });

    // Get preset by ID
    server.get('/:id', async (request: FastifyRequest) => {
        try {
            const { id } = request.params as { id: string };

            const preset = await findPresetById(id);
            if (!preset) {
                throw new NotFoundError('Preset not found');
            }

            // Only public presets or owner can view
            if (!preset.is_public) {
                const authHeader = request.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    throw new ForbiddenError('Access denied');
                }

                const token = authHeader.substring(7);
                const decoded = await server.jwt.verify(token);
                const userId = (decoded as any).userId;

                if (preset.user_id !== userId) {
                    throw new ForbiddenError('Access denied');
                }
            }

            return {
                preset: {
                    id: preset.id,
                    userId: preset.user_id,
                    userName: preset.userName,
                    name: preset.name,
                    description: preset.description,
                    presetType: preset.preset_type,
                    engineType: preset.engine_type,
                    category: preset.category,
                    presetData: preset.preset_data,
                    tags: preset.tags,
                    genre: preset.genre,
                    downloadsCount: preset.downloads_count,
                    ratingAvg: preset.rating_avg,
                    ratingCount: preset.rating_count,
                    isPublic: preset.is_public,
                    isFeatured: preset.is_featured,
                    createdAt: preset.created_at,
                    updatedAt: preset.updated_at,
                },
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Update preset
    server.put('/:id', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const { id } = request.params as { id: string };
            const body = UpdatePresetSchema.parse(request.body);

            const isOwner = await isPresetOwner(id, (request.user as any).userId);
            if (!isOwner) {
                throw new ForbiddenError('You do not have permission to edit this preset');
            }

            const preset = await updatePreset(id, {
                name: body.name,
                description: body.description,
                category: body.category,
                presetData: body.presetData,
                tags: body.tags,
                genre: body.genre,
                isPublic: body.isPublic,
            });

            return {
                preset: {
                    id: preset.id,
                    name: preset.name,
                    description: preset.description,
                    category: preset.category,
                    tags: preset.tags,
                    genre: preset.genre,
                    isPublic: preset.is_public,
                    updatedAt: preset.updated_at,
                },
            };
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                throw new BadRequestError(`Validation failed: ${details}`);
            }
            throw error;
        }
    });

    // Administrative Delete preset
    server.delete('/admin/:id', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const { id } = request.params as { id: string };

            // TODO: Add isAdmin check when roles are implemented
            // For now, following the pattern of systemAssets.ts where all auth users can access admin

            await deletePreset(id);

            return {
                message: 'Preset deleted successfully (Admin)',
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Download preset
    server.post('/:id/download', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const { id } = request.params as { id: string };

            const preset = await findPresetById(id);
            if (!preset) {
                throw new NotFoundError('Preset not found');
            }

            if (!preset.is_public && preset.user_id !== (request.user as any).userId) {
                throw new ForbiddenError('Access denied');
            }

            await downloadPreset({
                presetId: id,
                userId: (request.user as any).userId,
            });

            return {
                message: 'Preset downloaded',
                preset: {
                    id: preset.id,
                    name: preset.name,
                    presetType: preset.preset_type,
                    engineType: preset.engine_type,
                    userName: preset.userName,
                    presetData: preset.preset_data,
                },
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Rate preset
    server.post('/:id/rate', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const { id } = request.params as { id: string };
            const body = RatePresetSchema.parse(request.body);

            const preset = await findPresetById(id);
            if (!preset) {
                throw new NotFoundError('Preset not found');
            }

            const rating = await ratePreset({
                presetId: id,
                userId: (request.user as any).userId,
                rating: body.rating,
            });

            return {
                message: 'Preset rated successfully',
                rating: {
                    rating: rating.rating,
                    createdAt: rating.created_at,
                },
            };
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                throw new BadRequestError(`Validation failed: ${details}`);
            }
            throw error;
        }
    });

    // Search presets
    server.get('/search', async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const query = request.query as {
                q: string;
                presetType?: 'instrument' | 'effect';
                engineType?: string;
                limit?: string;
            };

            if (!query.q) {
                throw new BadRequestError('Search query is required');
            }

            const presets = await searchPresets(query.q, {
                presetType: query.presetType,
                engineType: query.engineType,
                limit: query.limit ? parseInt(query.limit, 10) : undefined,
            });

            return {
                presets: presets.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    presetType: p.preset_type,
                    engineType: p.engine_type,
                    category: p.category,
                    tags: p.tags,
                    ratingAvg: p.rating_avg,
                    downloadsCount: p.downloads_count,
                })),
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Get user's downloads
    server.get('/downloads/me', {
        preHandler: [server.authenticate],
    }, async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            if (!request.user) {
                throw new ForbiddenError('Authentication required');
            }

            const query = request.query as {
                page?: string;
                limit?: string;
                presetType?: 'instrument' | 'effect';
                engineType?: string;
            };

            const result = await getUserDownloads((request.user as any).userId, {
                page: query.page ? parseInt(query.page, 10) : undefined,
                limit: query.limit ? parseInt(query.limit, 10) : undefined,
                presetType: query.presetType,
                engineType: query.engineType,
            });

            return {
                presets: result.presets.map(p => ({
                    id: p.id,
                    userId: p.user_id,
                    userName: p.userName,
                    name: p.name,
                    description: p.description,
                    presetType: p.preset_type,
                    engineType: p.engine_type,
                    category: p.category,
                    presetData: p.preset_data,
                    tags: p.tags,
                    genre: p.genre,
                    downloadsCount: p.downloads_count,
                    ratingAvg: p.rating_avg,
                    ratingCount: p.rating_count,
                    createdAt: p.created_at,
                })),
                total: result.total,
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Get popular presets
    server.get('/popular', async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const query = request.query as {
                presetType?: 'instrument' | 'effect';
                engineType?: string;
                limit?: string;
            };

            const presets = await getPopularPresets({
                presetType: query.presetType,
                engineType: query.engineType,
                limit: query.limit ? parseInt(query.limit, 10) : undefined,
            });

            return {
                presets: presets.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    presetType: p.preset_type,
                    engineType: p.engine_type,
                    category: p.category,
                    tags: p.tags,
                    ratingAvg: p.rating_avg,
                    downloadsCount: p.downloads_count,
                })),
            };
        } catch (error: any) {
            throw error;
        }
    });

    // Get featured presets
    server.get('/featured', async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const query = request.query as {
                limit?: string;
            };

            const presets = await getFeaturedPresets(
                query.limit ? parseInt(query.limit, 10) : undefined
            );

            return {
                presets: presets.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    presetType: p.preset_type,
                    engineType: p.engine_type,
                    category: p.category,
                    tags: p.tags,
                    ratingAvg: p.rating_avg,
                    downloadsCount: p.downloads_count,
                })),
            };
        } catch (error: any) {
            throw error;
        }
    });
}
