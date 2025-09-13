import ChannelRack from '../features/channel_rack/ChannelRack';
import Mixer from '../features/mixer/Mixer';
import SampleEditor from '../features/sample_editor/SampleEditor';
import PianoRoll from '../features/piano_roll/PianoRoll';
import KeybindingsPanel from '../features/key_bindings/KeybindingsPanel';
import { ThemeEditor } from '../features/theme_editor/ThemeEditor'; // YENİ: Tema Editörünü import et

export const panelRegistry = {
  'channel-rack': ChannelRack,
  'mixer': Mixer,
  'sample-editor': SampleEditor,
  'piano-roll': PianoRoll,
  'keybindings': KeybindingsPanel,
  'theme-editor': ThemeEditor, // YENİ: Tema Editörünü kaydet
};

const CHANNEL_WIDTH = 112; 
const GAP_X = 16;
const BORDER_WIDTH = 8;
const PANEL_PADDING_X = 32;

export const panelDefinitions = {
  'channel-rack': {
    title: 'Channel Rack',
    initialSize: { width: 1200, height: 400 },
    initialPos: { x: 30, y: 20 },
    minSize: { width: 600, height: 250 },
  },
  'mixer': {
    title: 'Mixer',
    initialSize: {
      width: 850, // Genişliği biraz arttıralım
      height: 630
    },
    initialPos: { x: 40, y: 40 },
    minSize: { width: 400, height: 350 },
    disableResizing: true,
  },
  'sample-editor': {
    title: 'Sample Editor',
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
  // YENİ: Tema Editörü tanımı
  'theme-editor': {
    title: 'Tema Editörü',
    initialSize: { width: 450, height: 550 },
    initialPos: { x: 80, y: 120 },
    minSize: { width: 400, height: 500 },
  }
};