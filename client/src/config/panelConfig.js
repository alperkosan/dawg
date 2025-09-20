import ChannelRack from '../features/channel_rack/ChannelRack';
// import Mixer from '../features/mixer/Mixer'; // <-- 1. ESKİ MİKSERİ SİLİN VEYA YORUM SATIRI YAPIN
import { AdvancedMixer } from '../features/mixer_v2/AdvancedMixer'; // <-- 2. YENİ MİKSERİ IMPORT EDİN
import SampleEditorV2 from '../features/sample_editor_v3/SampleEditorV3';
import PianoRoll from '../features/piano_roll_v2/components/PianoRoll';
import ArrangementPanel from '../features/arrangement/ArrangementPanel';
import KeybindingsPanel from '../features/key_bindings/KeybindingsPanel';
import { ThemeEditor } from '../features/theme_editor/ThemeEditor';

export const panelRegistry = {
  'channel-rack': ChannelRack,
  'mixer': AdvancedMixer, // <-- 3. ESKİ MİKSERİ YENİSİYLE DEĞİŞTİRİN
  'sample-editor': SampleEditorV2,
  'piano-roll': PianoRoll,
  'keybindings': KeybindingsPanel,
  'arrangement': ArrangementPanel,
  'theme-editor': ThemeEditor,
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
    title: 'Mixer V2', // <-- 4. BAŞLIĞI GÜNCELLEYİN (İsteğe Bağlı)
    title: 'Piano Roll',
    initialSize: { width: 1000, height: 500 },
    initialPos: { x: 60, y: 80 },
    minSize: { width: 600, height: 300 },
  },
  'sample-editor': {
    title: 'Sample Editor V3',
    initialSize: { width: 800, height: 585 },
    initialPos: { x: 50, y: 60 },
    minSize: { width: 800, height: 585 },
    disableResizing: true,
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
  }
};