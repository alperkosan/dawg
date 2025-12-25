import { ProjectSerializer } from '@/lib/project/ProjectSerializer';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { NativeAudioEngineFacade } from '@/lib/core/NativeAudioEngineFacade';

/**
 * Runs an export task inside an isolated workspace so we don't mutate
 * whatever project the user currently has open in the DAW.
 *
 * - Backs up the current workspace (if any)
 * - Clears all stores
 * - Spins up a dedicated NativeAudioEngine instance
 * - Loads the provided project data
 * - Executes the export task
 * - Restores the previous workspace/engine afterwards
 *
 * @param {object} projectData Serialized project payload to load
 * @param {(context: { audioEngine: NativeAudioEngineFacade }) => Promise<any>} executor
 * @param {object} options
 * @param {boolean} options.preserveWorkspace Whether to restore the previous workspace after export (default: true)
 * @returns {Promise<any>} Result of the executor
 */
export async function runProjectExportSession(projectData, executor, options = {}) {
  if (!projectData) {
    throw new Error('Project data is required for export session');
  }

  const { preserveWorkspace = true } = options;

  const previousEngine = AudioEngineGlobal.get();
  let workspaceSnapshot = null;

  if (preserveWorkspace && typeof ProjectSerializer.serializeCurrentState === 'function') {
    workspaceSnapshot = ProjectSerializer.serializeCurrentState();
  }

  const hadWorkspaceBefore = preserveWorkspace && hasWorkspace(workspaceSnapshot);

  // Ensure stores are clean before loading the export project
  await ProjectSerializer.clearAll();

  const exportEngine = new NativeAudioEngineFacade();
  await exportEngine.initialize();
  await AudioContextService.setAudioEngine(exportEngine);
  await exportEngine.resumeAudioContext();

  await ProjectSerializer.deserialize(projectData);

  try {
    return await executor({ audioEngine: exportEngine });
  } finally {
    try {
      await ProjectSerializer.clearAll();
    } catch (error) {
      console.warn('⚠️ Failed to clear export session workspace:', error);
    }

    try {
      if (exportEngine.dispose) {
        await exportEngine.dispose();
      } else if (exportEngine.audioContext?.close) {
        await exportEngine.audioContext.close();
      }
    } catch (error) {
      console.warn('⚠️ Failed to dispose export engine:', error);
    }

    if (previousEngine) {
      await AudioContextService.setAudioEngine(previousEngine);
    } else {
      AudioContextService.dispose();
    }

    if (previousEngine && preserveWorkspace && workspaceSnapshot && hadWorkspaceBefore) {
      try {
        await ProjectSerializer.deserialize(workspaceSnapshot);
      } catch (error) {
        console.error('❌ Failed to restore previous workspace after export:', error);
      }
    }
  }
}

function hasWorkspace(snapshot) {
  if (!snapshot) return false;
  const instruments = snapshot.instruments || [];
  const patterns = snapshot.patterns || {};
  const arrangementTracks = snapshot.arrangement?.tracks || [];
  const mixerTracks = snapshot.mixer?.tracks || [];

  return (
    instruments.length > 0 ||
    Object.keys(patterns).length > 0 ||
    arrangementTracks.length > 0 ||
    mixerTracks.length > 0
  );
}

