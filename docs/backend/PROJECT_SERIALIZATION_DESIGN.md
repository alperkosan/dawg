# 📦 DAWG Project Serialization Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Proje verilerinin serialize/deserialize edilmesi için tasarım

---

## 📋 Overview

DAWG projesi, çoklu Zustand store'larda dağınık halde bulunan state'i tek bir JSON formatına serialize edip, backend'e kaydetmek ve geri yüklemek için bir sistem gerektirir.

---

## 🎯 Gereksinimler

### 1. Store Consolidation

Mevcut store'lar:
- `useArrangementStore` - Patterns, notes, clips
- `useArrangementV2Store` - Arrangement tracks, clips
- `useInstrumentsStore` - Instruments, samples
- `useMixerStore` - Mixer tracks, effects
- `usePlaybackStore` - Playback state
- `useTimelineStore` - Timeline settings
- `useProjectAudioStore` - Audio assets
- `useArrangementWorkspaceStore` - Workspace settings
- `useThemeStore` - UI theme (exclude from project)
- `usePanelsStore` - UI panels (exclude from project)

### 2. Serialization Requirements

- ✅ Tüm proje state'ini tek bir JSON objesine serialize et
- ✅ Audio asset referanslarını handle et (URL'ler, asset ID'ler)
- ✅ Circular reference'leri çöz
- ✅ Versioning desteği (format migration)
- ✅ Compression (gzip)
- ✅ Validation (schema validation)

### 3. Deserialization Requirements

- ✅ JSON'dan store'lara geri yükleme
- ✅ Asset referanslarını resolve etme
- ✅ Version migration (eski formatları yeni formata çevirme)
- ✅ Error handling (corrupted data)

---

## 📊 Project Data Schema

### TypeScript Interface

```typescript
interface ProjectData {
  // =================== METADATA ===================
  metadata: {
    version: string; // Project format version "1.0.0"
    dawg_version: string; // Client version that created this
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
    bpm: number;
    time_signature: string; // "4/4"
    key_signature?: string; // "C major"
    title?: string;
    description?: string;
  };

  // =================== INSTRUMENTS ===================
  instruments: InstrumentData[];
  // From useInstrumentsStore

  // =================== PATTERNS ===================
  patterns: PatternData[];
  pattern_order: string[]; // Pattern ID order
  // From useArrangementStore

  // =================== ARRANGEMENT ===================
  arrangement: {
    tracks: ArrangementTrackData[];
    clips: ArrangementClipData[];
    markers: MarkerData[];
    loop_regions: LoopRegionData[];
  };
  // From useArrangementV2Store

  // =================== MIXER ===================
  mixer: {
    tracks: MixerTrackData[];
    send_channels: SendChannelData[];
    master: MasterChannelData;
  };
  // From useMixerStore

  // =================== TIMELINE ===================
  timeline: {
    total_beats: number;
    total_bars: number;
    zoom: { x: number; y: number };
    snap_mode: string;
    grid_size: string;
  };
  // From TimelineStore

  // =================== AUDIO ASSETS ===================
  audio_assets: AudioAssetReference[];
  // References to project_assets table
  // From useProjectAudioStore

  // =================== SETTINGS ===================
  settings: {
    quantization: string;
    edit_mode: string;
    // Other project-specific settings
  };
}
```

### Detailed Data Structures

#### InstrumentData

```typescript
interface InstrumentData {
  id: string;
  name: string;
  type: string; // 'sample', 'vasynth', etc.
  color: string;
  mixerTrackId: string;
  
  // Sample-specific
  url?: string; // Original file URL (for reference)
  assetId?: string; // Reference to project_assets
  baseNote?: number;
  multiSamples?: MultiSampleData[];
  
  // VA Synth-specific
  presetName?: string;
  presetData?: object;
  
  // Common
  envelope: EnvelopeData;
  effectChain: EffectData[];
  notes: NoteData[]; // Pattern notes
  sampleChop?: SampleChopData;
  precomputed?: object;
  
  // UI state (optional)
  isMuted?: boolean;
  cutItself?: boolean;
  pianoRoll?: boolean;
}
```

#### PatternData

```typescript
interface PatternData {
  id: string;
  name: string;
  instrumentId: string;
  steps: number; // Pattern length in steps
  notes: NoteData[];
  // Notes are stored per-pattern, not per-instrument
}
```

#### ArrangementTrackData

```typescript
interface ArrangementTrackData {
  id: string;
  name: string;
  height: number;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  collapsed: boolean;
  instrumentId?: string; // If linked to instrument
}
```

#### ArrangementClipData

```typescript
interface ArrangementClipData {
  id: string;
  type: 'audio' | 'pattern';
  trackId: string;
  startTime: number; // In beats
  duration: number; // In beats
  
  // Audio clip
  assetId?: string; // Reference to project_assets
  sampleOffset?: number;
  playbackRate?: number;
  fadeIn?: number;
  fadeOut?: number;
  gain?: number;
  name?: string;
  
  // Pattern clip
  patternId?: string;
  instrumentId?: string;
  loopCount?: number;
  patternOffset?: number; // For split clips
  
  // Common
  muted?: boolean;
  locked?: boolean;
}
```

#### MixerTrackData

```typescript
interface MixerTrackData {
  id: string;
  name: string;
  gain: number;
  pan: number;
  
  // EQ
  eq: {
    lowGain: number;
    midGain: number;
    highGain: number;
    lowFreq: number;
    highFreq: number;
  };
  
  // Effects
  effects: EffectData[];
  
  // Routing
  sendLevels: Record<string, number>; // sendId -> level
  
  // State
  muted: boolean;
  solo: boolean;
  mono: boolean;
}
```

#### EffectData

```typescript
interface EffectData {
  id: string;
  type: string; // 'modern-delay', 'modern-reverb', 'compressor', etc.
  enabled: boolean;
  bypass: boolean;
  parameters: Record<string, any>; // Effect-specific parameters
  position: number; // Order in chain
}
```

#### AudioAssetReference

```typescript
interface AudioAssetReference {
  id: string; // Local asset ID (for client-side)
  assetId: string; // Backend asset ID (UUID)
  name: string;
  url: string; // CDN URL or local path
  durationBeats: number;
  durationSeconds: number;
  type: 'frozen' | 'stem' | 'bounce' | 'upload';
  metadata: {
    sampleRate?: number;
    bitDepth?: number;
    channels?: number;
    originalPattern?: string; // If frozen from pattern
  };
}
```

---

## 🔧 Implementation

### ProjectSerializer Class

```typescript
// src/lib/project/ProjectSerializer.ts

import { useArrangementStore } from '@/store/useArrangementStore';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { useTimelineStore } from '@/store/TimelineStore';
import { useProjectAudioStore } from '@/store/useProjectAudioStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';

export class ProjectSerializer {
  private static readonly CURRENT_VERSION = '1.0.0';

  /**
   * Serialize all project state to JSON
   */
  static serialize(): ProjectData {
    // Get all store states
    const arrangementStore = useArrangementStore.getState();
    const arrangementV2Store = useArrangementV2Store.getState();
    const instrumentsStore = useInstrumentsStore.getState();
    const mixerStore = useMixerStore.getState();
    const timelineStore = useTimelineStore.getState();
    const projectAudioStore = useProjectAudioStore.getState();
    const playbackStore = usePlaybackStore.getState();

    // Build project data
    const projectData: ProjectData = {
      metadata: {
        version: this.CURRENT_VERSION,
        dawg_version: import.meta.env.VITE_APP_VERSION || '0.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bpm: playbackStore.bpm || 120,
        time_signature: playbackStore.timeSignature || '4/4',
        key_signature: playbackStore.keySignature,
      },

      instruments: this.serializeInstruments(instrumentsStore),
      patterns: this.serializePatterns(arrangementStore),
      pattern_order: arrangementStore.patternOrder || [],
      
      arrangement: {
        tracks: this.serializeArrangementTracks(arrangementV2Store),
        clips: this.serializeArrangementClips(arrangementV2Store),
        markers: arrangementStore.markers || [],
        loop_regions: arrangementStore.loopRegions || [],
      },

      mixer: {
        tracks: this.serializeMixerTracks(mixerStore),
        send_channels: mixerStore.sendChannels || [],
        master: this.serializeMasterChannel(mixerStore),
      },

      timeline: {
        total_beats: timelineStore.totalBeats || 64,
        total_bars: timelineStore.totalBars || 4,
        zoom: timelineStore.zoom || { x: 1, y: 1 },
        snap_mode: timelineStore.snapMode || 'grid',
        grid_size: timelineStore.gridSize || '1/4',
      },

      audio_assets: this.serializeAudioAssets(projectAudioStore),

      settings: {
        quantization: arrangementStore.quantization || '1/16',
        edit_mode: arrangementV2Store.editMode || 'select',
      },
    };

    return projectData;
  }

  /**
   * Deserialize JSON to project state
   */
  static async deserialize(projectData: ProjectData): Promise<void> {
    // Validate version
    if (projectData.metadata.version !== this.CURRENT_VERSION) {
      await this.migrateVersion(projectData);
    }

    // Validate schema
    this.validateProjectData(projectData);

    // Restore stores
    await this.deserializeInstruments(projectData.instruments);
    await this.deserializePatterns(projectData.patterns, projectData.pattern_order);
    await this.deserializeArrangement(projectData.arrangement);
    await this.deserializeMixer(projectData.mixer);
    await this.deserializeTimeline(projectData.timeline);
    await this.deserializeAudioAssets(projectData.audio_assets);
    await this.deserializeSettings(projectData.settings);

    // Restore playback state
    const playbackStore = usePlaybackStore.getState();
    playbackStore.setBPM(projectData.metadata.bpm);
    playbackStore.setTimeSignature(projectData.metadata.time_signature);
  }

  // ... Helper methods for serialization/deserialization
}
```

### Asset Reference Resolution

```typescript
/**
 * Resolve asset references when loading project
 */
private static async resolveAssetReferences(
  audioAssets: AudioAssetReference[]
): Promise<void> {
  const audioAssetManager = (await import('@/lib/audio/AudioAssetManager.js')).audioAssetManager;

  for (const assetRef of audioAssets) {
    // If asset is already loaded, skip
    if (audioAssetManager.getAsset(assetRef.assetId)) {
      continue;
    }

    // Load asset from URL
    try {
      await audioAssetManager.loadAsset(assetRef.url, {
        id: assetRef.assetId,
        name: assetRef.name,
        source: 'project',
        ...assetRef.metadata,
      });
    } catch (error) {
      console.warn(`Failed to load asset ${assetRef.assetId}:`, error);
      // Continue loading other assets
    }
  }
}
```

### Version Migration

```typescript
/**
 * Migrate project data from older versions
 */
private static async migrateVersion(projectData: ProjectData): Promise<ProjectData> {
  const version = projectData.metadata.version;

  // Version 1.0.0 -> 1.1.0 migration example
  if (version === '1.0.0') {
    // Add new fields, transform data, etc.
    projectData.metadata.version = '1.1.0';
  }

  // Recursive migration if needed
  if (projectData.metadata.version !== this.CURRENT_VERSION) {
    return this.migrateVersion(projectData);
  }

  return projectData;
}
```

### Compression

```typescript
/**
 * Compress project data for storage
 */
static compress(projectData: ProjectData): Uint8Array {
  const jsonString = JSON.stringify(projectData);
  // Use pako or similar for gzip compression
  return pako.gzip(jsonString);
}

/**
 * Decompress project data
 */
static decompress(compressed: Uint8Array): ProjectData {
  const jsonString = pako.ungzip(compressed, { to: 'string' });
  return JSON.parse(jsonString);
}
```

---

## 🔄 Save/Load Flow

### Save Flow

```
1. User clicks "Save Project"
2. ProjectSerializer.serialize() → ProjectData
3. Compress project data (gzip)
4. Extract audio asset references
5. Upload audio assets (if not already uploaded)
6. POST /api/projects with project data
7. Backend stores project_data (JSONB) and asset references
8. Return project ID
```

### Load Flow

```
1. User opens project
2. GET /api/projects/:id
3. Backend returns project_data (JSONB) and asset references
4. Decompress project data
5. ProjectSerializer.deserialize(projectData)
6. Resolve asset references (load audio files)
7. Restore all stores
8. UI updates
```

---

## ✅ Validation

### Schema Validation (Zod)

```typescript
import { z } from 'zod';

const ProjectDataSchema = z.object({
  metadata: z.object({
    version: z.string(),
    dawg_version: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    bpm: z.number(),
    time_signature: z.string(),
    key_signature: z.string().optional(),
  }),
  instruments: z.array(InstrumentDataSchema),
  patterns: z.array(PatternDataSchema),
  // ... etc
});

function validateProjectData(data: unknown): ProjectData {
  return ProjectDataSchema.parse(data);
}
```

---

## 📝 Best Practices

1. **Exclude UI State:** Don't serialize UI-only state (theme, panels, etc.)
2. **Asset References:** Store references, not full audio data
3. **Versioning:** Always version project format for migration
4. **Validation:** Validate before save and after load
5. **Error Handling:** Graceful degradation if assets can't be loaded
6. **Compression:** Always compress for storage (saves ~70% space)
7. **Incremental Save:** Save only changed parts (future optimization)

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Design Complete

