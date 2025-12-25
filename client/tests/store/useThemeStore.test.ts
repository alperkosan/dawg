/**
 * @fileoverview Integration tests for useThemeStore
 * Tests the Zenith theme system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/store/useThemeStore';

describe('useThemeStore', () => {
    it('should have built-in themes', () => {
        const state = useThemeStore.getState();
        expect(state.themes.length).toBeGreaterThan(0);
        expect(state.activeThemeId).toBeDefined();
    });

    it('should have getActiveTheme function', () => {
        const { getActiveTheme } = useThemeStore.getState();
        expect(typeof getActiveTheme).toBe('function');

        const activeTheme = getActiveTheme();
        expect(activeTheme).toBeDefined();
        expect(activeTheme.name).toBeDefined();
        expect(activeTheme.colors).toBeDefined();
        expect(activeTheme.zenith).toBeDefined();
    });

    it('should have Zenith design tokens in active theme', () => {
        const { getActiveTheme } = useThemeStore.getState();
        const theme = getActiveTheme();

        // Check for critical Zenith tokens
        expect(theme.zenith['bg-primary']).toBeDefined();
        expect(theme.zenith['bg-secondary']).toBeDefined();
        expect(theme.zenith['accent-hot']).toBeDefined();
        expect(theme.zenith['text-primary']).toBeDefined();
    });

    it('should switch themes', () => {
        const state = useThemeStore.getState();
        const themes = state.themes;

        // Switch to a different theme
        const differentTheme = themes.find(t => t.id !== state.activeThemeId);
        if (differentTheme) {
            state.setActiveThemeId(differentTheme.id);
            expect(useThemeStore.getState().activeThemeId).toBe(differentTheme.id);
        }
    });

    it('should have theme presets with correct structure', () => {
        const { themes } = useThemeStore.getState();

        themes.forEach(theme => {
            // Each theme should have core properties
            expect(theme.id).toBeDefined();
            expect(theme.name).toBeDefined();
            expect(typeof theme.name).toBe('string');

            // Each theme should have color palette
            expect(theme.colors.background).toBeDefined();
            expect(theme.colors.primary).toBeDefined();
            expect(theme.colors.text).toBeDefined();
        });
    });

    it('should have workspace texture tokens', () => {
        const { getActiveTheme } = useThemeStore.getState();
        const theme = getActiveTheme();

        // Workspace texture tokens (premium feature)
        expect(theme.zenith['workspace-grid-size']).toBeDefined();
    });
});
