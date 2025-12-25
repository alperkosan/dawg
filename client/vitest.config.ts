import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.{ts,tsx,js,jsx}'],
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/lib/**/*', 'src/store/**/*'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/components': path.resolve(__dirname, './src/components'),
            '@/features': path.resolve(__dirname, './src/features'),
            '@/lib': path.resolve(__dirname, './src/lib'),
            '@/store': path.resolve(__dirname, './src/store'),
            '@/config': path.resolve(__dirname, './src/config'),
            '@/layout': path.resolve(__dirname, './src/layout'),
            '@/assets': path.resolve(__dirname, './src/assets'),
        },
    },
});
