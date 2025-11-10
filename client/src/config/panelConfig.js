import ChannelRack from '@/features/channel_rack/ChannelRack';
import Mixer from '@/features/mixer/Mixer'; // FL Studio style mixer with cable routing
import SampleEditorV2 from '@/features/sample_editor_v3/SampleEditorV3';
import PianoRoll from '@/features/piano_roll_v7/PianoRoll';
import { ArrangementPanelV2 } from '@/features/arrangement_v2';
import KeybindingsPanel from '@/features/key_bindings/KeybindingsPanel';
import { ThemeEditor } from '@/features/theme_editor/ThemeEditor';
import { ForgeSynthUI } from '@/features/instrument_editor/ForgeSynthUI';
import AudioQualitySettings from '@/components/AudioQualitySettings';
import AudioQualitySettings_v2 from '@/components/AudioQualitySettings_v2';
import FileBrowserPanel from '@/features/file_browser/FileBrowserPanel';
import { AIInstrumentPanel } from '@/features/ai_instrument/AIInstrumentPanel';

export const panelRegistry = {
  'channel-rack': ChannelRack,
  'mixer': Mixer, // ✅ Now uses Mixer_2 (FL Studio style)
  'sample-editor': SampleEditorV2,
  'piano-roll': PianoRoll,
  'file-browser': FileBrowserPanel,
  'keybindings': KeybindingsPanel,
  'arrangement-v2': ArrangementPanelV2,
  'theme-editor': ThemeEditor,
  'instrument-editor-forgesynth': ForgeSynthUI,
  'audio-quality-settings': AudioQualitySettings_v2, // ✅ V2 with modern design
  'audio-quality-settings-v1': AudioQualitySettings, // Legacy version
  'ai-instrument': AIInstrumentPanel, // ✨ AI Instrument Generator
};

export const panelDefinitions = {
  'arrangement-v2': {
    title: 'Arrangement V2 🎵',
    initialSize: { width: 1200, height: 700 },
    initialPos: { x: 10, y: 5 },
    minSize: { width: 800, height: 500 },
    isFullscreen: true, // Fullscreen mode for arrangement panel
  },
  'channel-rack': {
    title: 'Channel Rack',
    initialSize: { width: 900, height: 400 },
    initialPos: { x: 30, y: 20 },
    minSize: { width: 600, height: 250 },
  },
  'mixer': {
    title: 'Mixer',
    initialSize: { width: 1200, height: 750 },
    initialPos: { x: 50, y: 60 },
    minSize: { width: 900, height: 600 },
  },
  'sample-editor': {
    title: 'Sample Editor',
    // YENİ: Varsayılan yüksekliği azalttık (~%40 değil ama makul bir seviyeye çektik)
    initialSize: { width: 800, height: 595 },
    initialPos: { x: 50, y: 60 },
    // YENİ: Artık daha fazla küçültülebilir
    minSize: { width: 550, height: 595 },
    // YENİ: Yeniden boyutlandırma kilidi kaldırıldı!
    // disableResizing: true, <-- BU SATIRI SİLDİK
  },
  'piano-roll': {
    title: 'Piano Roll',
    initialSize: { width: 900, height: 500 },
    initialPos: { x: 60, y: 80 },
    minSize: { width: 600, height: 300 },
  },
  'file-browser': {
    title: 'File Browser',
    initialSize: { width: 400, height: 600 },
    initialPos: { x: 40, y: 40 },
    minSize: { width: 300, height: 400 },
  },
  'keybindings': {
    title: 'Klavye Kısayolları',
    initialSize: { width: 500, height: 600 },
    initialPos: { x: 70, y: 100 },
    minSize: { width: 350, height: 400 },
  },
  'theme-editor': {
    title: 'Tema Editörü',
    initialSize: { width: 450, height: 550 },
    initialPos: { x: 80, y: 120 },
    minSize: { width: 400, height: 500 },
  },
  'instrument-editor-forgesynth': {
    title: 'ForgeSynth v1',
    initialSize: { width: 600, height: 280 },
    initialPos: { x: 80, y: 90 },
    minSize: { width: 500, height: 250 },
  },
  'audio-quality-settings': {
    title: 'Audio Quality Settings',
    initialSize: { width: 900, height: 700 },
    initialPos: { x: 100, y: 50 },
    minSize: { width: 700, height: 500 },
  },
  'ai-instrument': {
    title: 'AI Instrument Generator ✨',
    initialSize: { width: 600, height: 800 },
    initialPos: { x: 120, y: 140 },
    minSize: { width: 500, height: 600 },
  },
};