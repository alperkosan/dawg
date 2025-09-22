// tests/audioworklet.test.js
import { WorkletManager } from '../src/lib/audio/WorkletManager';
import { WorkletInstrument } from '../src/lib/audio/WorkletInstrument';

describe('AudioWorklet Integration', () => {
  let audioContext;
  let workletManager;

  beforeEach(() => {
    // Mock AudioContext
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    workletManager = new WorkletManager(audioContext);
  });

  test('WorkletManager loads processors correctly', async () => {
    const loaded = await workletManager.loadWorklet(
      '/worklets/instrument-processor.js', 
      'instrument-processor'
    );
    
    expect(loaded).toBe(true);
    expect(workletManager.loadedWorklets.has('instrument-processor')).toBe(true);
  });

  test('WorkletInstrument triggers notes correctly', async () => {
    const instrumentData = {
      id: 'test-synth',
      name: 'Test Synth',
      type: 'synth'
    };

    const workletInst = new WorkletInstrument(instrumentData, audioContext);
    await workletInst.initialize();

    expect(workletInst.isReady).toBe(true);
    
    // Note trigger test
    expect(() => {
      workletInst.triggerNote('C4', 0.8);
    }).not.toThrow();
  });

  test('Parameter updates work correctly', async () => {
    const workletInst = new WorkletInstrument({
      id: 'test', name: 'Test', type: 'synth'
    }, audioContext);
    
    await workletInst.initialize();
    
    workletInst.updateParameter('filterFreq', 2000);
    
    const param = workletInst.parameters.get('filterFreq');
    expect(param.value).toBeCloseTo(2000, 1);
  });

  afterEach(() => {
    audioContext.close();
  });
});