import ChannelRack from '../features/channel_rack/ChannelRack';
// import Mixer from '../features/mixer/Mixer'; // <-- 1. ESKİ MİKSERİ SİLİN VEYA YORUM SATIRI YAPIN
import MixerV3 from '../features/mixer_v3/MixerV3'; // <-- 2. YENİ MİKSERİ IMPORT EDİN
import SampleEditorV2 from '../features/sample_editor_v3/SampleEditorV3';
import PianoRoll from '../features/piano_roll_v7/PianoRoll';
import ArrangementPanel from '../features/arrangement/ArrangementPanel';
import KeybindingsPanel from '../features/key_bindings/KeybindingsPanel';
import { ThemeEditor } from '../features/theme_editor/ThemeEditor';
import { ForgeSynthUI } from '../features/instrument_editor/ForgeSynthUI';
import AudioQualitySettings from '../components/AudioQualitySettings';

export const panelRegistry = {
  'channel-rack': ChannelRack,
  'mixer': MixerV3,
  'sample-editor': SampleEditorV2,
  'piano-roll': PianoRoll,
  'keybindings': KeybindingsPanel,
  'arrangement': ArrangementPanel,
  'theme-editor': ThemeEditor,
  'instrument-editor-forgesynth': ForgeSynthUI,
  'audio-quality-settings': AudioQualitySettings,
};

export const panelDefinitions = {
  'arrangement': {
    title: 'Arrangement',
    initialSize: { width: 1400, height: 600 },
    initialPos: { x: 20, y: 10 },
    minSize: { width: 800, height: 400 },
  },
  'channel-rack': {
    title: 'Channel Rack',
    initialSize: { width: 1200, height: 400 },
    initialPos: { x: 30, y: 20 },
    minSize: { width: 600, height: 250 },
  },
  'mixer': {
    title: 'Mixer V3', // <-- 4. BAŞLIĞI GÜNCELLEYİN (İsteğe Bağlı)
    initialSize: { width: 1000, height: 500 },
    initialPos: { x: 60, y: 80 },
    minSize: { width: 600, height: 300 },
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
    initialSize: { width: 1000, height: 500 },
    initialPos: { x: 60, y: 80 },
    minSize: { width: 600, height: 300 },
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
};