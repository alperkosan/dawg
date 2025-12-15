/**
 * Render Page - Headless audio rendering for backend
 * This page is only used by Puppeteer to render project audio
 * No UI, just renders and sets window.renderResult
 */

import React, { useEffect } from 'react';
import { NativeAudioEngine } from '@/lib/core/NativeAudioEngine';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { ProjectSerializer } from '@/lib/project/ProjectSerializer';
import { exportManager } from '@/lib/audio/AudioExportManager.js';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { apiClient } from '@/services/api.js';

export default function RenderPage() {
  useEffect(() => {
    console.log('🎬 [RENDER] ========================================');
    console.log('🎬 [RENDER] RenderPage mounted, useEffect running...');
    console.log('🎬 [RENDER] Window location:', window.location.href);

    // Mark that the page has mounted (for Puppeteer to detect)
    window.renderPageMounted = true;

    const projectId = new URLSearchParams(window.location.search).get('projectId');
    console.log('🎬 [RENDER] ProjectId from URL:', projectId);

    if (projectId) {
      console.log('🎬 [RENDER] Starting renderProject...');
      // Initialize window properties
      window.renderResult = undefined;
      window.renderError = undefined;

      // Start render asynchronously
      renderProject(projectId).catch((error) => {
        console.error('❌ [RENDER] Render failed:', error);
        console.error('❌ [RENDER] Error details:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
        window.renderError = error?.message || error?.toString() || 'Render failed';
      });
    } else {
      console.error('❌ [RENDER] No projectId provided in URL');
      window.renderError = 'No projectId provided';
    }
  }, []);

  async function renderProject(projectId) {
    const renderStartTime = Date.now();
    try {
      console.log(`🎬 [RENDER] ========================================`);
      console.log(`🎬 [RENDER] Starting render for project: ${projectId}`);
      console.log(`🎬 [RENDER] ========================================`);

      // 1. Load project data
      console.log(`📥 [RENDER] Step 1/7: Loading project data...`);
      const loadStart = Date.now();
      const projectResponse = await apiClient.getProject(projectId);
      const project = projectResponse.project;
      const loadTime = Date.now() - loadStart;
      console.log(`✅ [RENDER] Project data loaded in ${loadTime}ms`);

      if (!project || !project.projectData) {
        throw new Error('Project data not found');
      }
      console.log(`📊 [RENDER] Project: ${project.title}, BPM: ${project.bpm || 120}`);

      // 2. Initialize audio engine
      console.log(`🎵 [RENDER] Step 2/7: Initializing audio engine...`);
      const engineStart = Date.now();

      // Create and initialize NativeAudioEngine (same as App.jsx)
      const audioEngine = new NativeAudioEngine();
      await audioEngine.initialize();

      // Set the engine in AudioContextService
      await AudioContextService.setAudioEngine(audioEngine);

      // Resume AudioContext (required for headless browser)
      await audioEngine.resumeAudioContext();

      const engineTime = Date.now() - engineStart;
      console.log(`✅ [RENDER] Audio engine initialized in ${engineTime}ms`);

      if (!audioEngine) {
        throw new Error('Failed to initialize audio engine');
      }

      // 3. Load project into engine
      console.log(`📦 [RENDER] Step 3/7: Loading project into audio engine...`);
      const deserializeStart = Date.now();
      await ProjectSerializer.deserialize(project.projectData, audioEngine);
      const deserializeTime = Date.now() - deserializeStart;
      console.log(`✅ [RENDER] Project deserialized in ${deserializeTime}ms`);

      // 4. Wait for audio engine to be ready
      console.log(`⏳ [RENDER] Step 4/7: Waiting for audio engine to be ready...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`✅ [RENDER] Audio engine ready`);

      // 5. Get arrangement data
      console.log(`📊 [RENDER] Step 5/7: Calculating arrangement duration...`);
      const arrangementStore = useArrangementStore.getState();
      const playbackStore = usePlaybackStore.getState();
      const bpm = playbackStore.bpm || project.bpm || 120;

      // Calculate arrangement duration
      const arrangementTracks = arrangementStore.arrangementTracks || [];
      const clips = arrangementStore.arrangementClips || [];

      console.log(`📊 [RENDER] Arrangement: ${arrangementTracks.length} tracks, ${clips.length} clips`);

      let maxEndTime = 0;
      clips.forEach(clip => {
        const clipEndTime = (clip.startTime || 0) + (clip.duration || 0);
        maxEndTime = Math.max(maxEndTime, clipEndTime);
      });

      // If no clips, use default duration (4 bars)
      const durationBeats = maxEndTime > 0 ? maxEndTime : 16;
      const durationSeconds = (durationBeats / 4) * (60 / bpm);

      console.log(`📊 [RENDER] Arrangement duration: ${durationSeconds.toFixed(2)}s (${durationBeats} beats at ${bpm} BPM)`);

      // 6. Export master channel (includes all mixer effects)
      console.log(`🎛️ [RENDER] Step 6/7: Exporting master channel with effects...`);
      const exportStart = Date.now();
      const exportResult = await exportManager.exportChannels(
        ['master'],
        {
          format: 'wav',
          quality: 'STANDARD',
          mode: 'OFFLINE',
          includeEffects: true,
          normalize: true,
          fadeOut: true,
          fadeOutDuration: 0.1,
          stereo: true,
          startTime: 0,
          endTime: durationBeats, // in beats
        },
        (channelId, progress, status) => {
          console.log(`📊 [RENDER] Export progress: ${progress}% - ${status}`);
        }
      );
      const exportTime = Date.now() - exportStart;
      console.log(`✅ [RENDER] Export completed in ${exportTime}ms`);

      if (!exportResult || exportResult.length === 0) {
        throw new Error('Export failed - no result');
      }

      const exportedFile = exportResult[0];
      if (!exportedFile || !exportedFile.file) {
        throw new Error('Export failed - no file');
      }

      // 7. Read audio file as buffer
      console.log(`📖 [RENDER] Step 7/7: Reading exported audio file...`);
      const readStart = Date.now();
      const audioFile = exportedFile.file;
      const arrayBuffer = await audioFile.arrayBuffer();
      const readTime = Date.now() - readStart;
      console.log(`✅ [RENDER] Audio file read in ${readTime}ms (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

      // 8. Convert to base64 (browser-compatible, handles large arrays)
      console.log(`🔄 [RENDER] Converting to base64...`);
      const encodeStart = Date.now();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192; // Process in chunks to avoid stack overflow
      const totalChunks = Math.ceil(uint8Array.length / chunkSize);
      console.log(`📊 [RENDER] Processing ${totalChunks} chunks...`);

      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
        if (i % (chunkSize * 100) === 0) {
          const progress = ((i / uint8Array.length) * 100).toFixed(1);
          console.log(`📊 [RENDER] Base64 encoding: ${progress}%`);
        }
      }
      const base64 = btoa(binary);
      const encodeTime = Date.now() - encodeStart;
      console.log(`✅ [RENDER] Base64 encoding completed in ${encodeTime}ms (${(base64.length / 1024 / 1024).toFixed(2)} MB)`);

      // 9. Set result for Puppeteer
      window.renderResult = {
        audioBuffer: base64,
        duration: durationSeconds,
      };

      const totalTime = Date.now() - renderStartTime;
      console.log(`✅ [RENDER] ========================================`);
      console.log(`✅ [RENDER] Render completed successfully!`);
      console.log(`✅ [RENDER] Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
      console.log(`✅ [RENDER] Duration: ${durationSeconds.toFixed(2)}s`);
      console.log(`✅ [RENDER] Buffer size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
      console.log(`✅ [RENDER] ========================================`);
    } catch (error) {
      const totalTime = Date.now() - renderStartTime;
      console.error(`❌ [RENDER] ========================================`);
      console.error(`❌ [RENDER] Render failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
      console.error(`❌ [RENDER] Error:`, error);
      console.error(`❌ [RENDER] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId,
      });
      console.error(`❌ [RENDER] ========================================`);
      window.renderError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  // No UI - this page is only for Puppeteer
  return (
    <div style={{ display: 'none' }}>
      Rendering audio...
    </div>
  );
}

