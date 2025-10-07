// lib/core/TimelineControllerSingleton.js
/**
 * 🎯 TIMELINE CONTROLLER SINGLETON
 *
 * Global singleton instance for unified timeline control
 * Used across all panels (Channel Rack, Piano Roll, Arrangement)
 */

import { TimelineController } from './TimelineController.js';

let timelineControllerInstance = null;

/**
 * Initialize the global timeline controller
 * Called once during app initialization with the audio engine
 */
export function initializeTimelineController(audioEngine, initialBPM = 140) {
  if (timelineControllerInstance) {
    console.warn('⚠️ TimelineController already initialized');
    return timelineControllerInstance;
  }

  console.log('🎯 Initializing TimelineController singleton with BPM:', initialBPM);
  timelineControllerInstance = new TimelineController(audioEngine, initialBPM);

  return timelineControllerInstance;
}

/**
 * Get the global timeline controller instance
 * Throws if not initialized
 */
export function getTimelineController() {
  if (!timelineControllerInstance) {
    throw new Error('TimelineController not initialized. Call initializeTimelineController() first.');
  }
  return timelineControllerInstance;
}

/**
 * Destroy the global timeline controller
 * Called during app cleanup
 */
export function destroyTimelineController() {
  if (timelineControllerInstance) {
    console.log('🎯 Destroying TimelineController singleton');
    timelineControllerInstance.destroy();
    timelineControllerInstance = null;
  }
}

/**
 * Check if timeline controller is initialized
 */
export function isTimelineControllerInitialized() {
  return timelineControllerInstance !== null;
}
