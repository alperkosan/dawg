import ChannelRack from '../features/channel_rack/ChannelRack';
import Mixer from '../features/mixer/Mixer';
import SampleEditor from '../features/sample_editor/SampleEditor';
import PianoRoll from '../features/piano_roll/PianoRoll';
import KeybindingsPanel from '../features/key_bindings/KeybindingsPanel';

export const panelRegistry = {
  'channel-rack': ChannelRack,
  'mixer': Mixer,
  'sample-editor': SampleEditor,
  'piano-roll': PianoRoll,
  'keybindings': KeybindingsPanel,
};

const CHANNEL_WIDTH = 112; 
const GAP_X = 16;
const BORDER_WIDTH = 8;
const PANEL_PADDING_X = 32;

export const panelDefinitions = {
  'channel-rack': {
    title: 'Channel Rack',
    initialSize: { width: 1200, height: 400 },
    initialPos: { x: 300, y: 20 },
    minSize: { width: 600, height: 250 },
  },
  'mixer': {
    title: 'Mixer',
    initialSize: {
      width: PANEL_PADDING_X + (CHANNEL_WIDTH * 6) + (GAP_X * 5) + (BORDER_WIDTH * 2),
      height: 630
    },
    initialPos: { x: 320, y: 40 },
    minSize: { width: 400, height: 350 },
    disableResizing: true,
  },
  'sample-editor': {
    title: 'Sample Editor',
    initialSize: { width: 800, height: 585 },
    initialPos: { x: 340, y: 60 },
    minSize: { width: 800, height: 585 },
    disableResizing: true,
  },
  'piano-roll': {
    title: 'Piano Roll',
    initialSize: { width: 1000, height: 500 },
    initialPos: { x: 360, y: 80 },
    minSize: { width: 600, height: 300 },
  },
  'keybindings': {
    title: 'Klavye Kısayolları',
    initialSize: { width: 500, height: 600 },
    initialPos: { x: 400, y: 100 },
    minSize: { width: 350, height: 400 },
  }
};