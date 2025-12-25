/**
 * @deprecated useMixerUIStore has been merged into useMixerStore
 * 
 * All UI state (activeChannelId, expandedChannels, etc.) is now part of useMixerStore.
 * 
 * Migration:
 * - import { useMixerStore } from '@/store/useMixerStore';
 * - const activeChannelId = useMixerStore(state => state.activeChannelId);
 * 
 * This file is kept for backward compatibility but will be removed in a future version.
 */

import { useMixerStore } from './useMixerStore';

// Re-export useMixerStore as useMixerUIStore for backward compatibility
export const useMixerUIStore = useMixerStore;

// Log deprecation warning in development
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '⚠️ DEPRECATED: useMixerUIStore has been merged into useMixerStore. ' +
    'Please update your imports to use useMixerStore directly.'
  );
}