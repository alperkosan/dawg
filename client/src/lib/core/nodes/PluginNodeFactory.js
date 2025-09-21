import * as Tone from 'tone';
import { pluginRegistry } from '../../../config/pluginConfig';
import { setParamSmoothly } from '../../utils/audioUtils';

export const PluginNodeFactory = {
  create(fxData) {
    const pluginDef = pluginRegistry[fxData.type];
    if (!pluginDef) return null;
    
    const builder = this.builders[pluginDef.toneNode] || this.builders.default;
    return builder(fxData, pluginDef);
  },

  builders: {
    default: (fxData, pluginDef) => {
      const NodeClass = Tone[pluginDef.toneNode];
      if (!NodeClass) return null;
      
      const node = new NodeClass(fxData.settings);
      if (typeof node.wet !== 'undefined') node.wet.value = fxData.settings.wet ?? 1.0;
      
      return {
        input: node,
        output: node,
        updateParam: (param, value) => {
          try {
            if (node[param] && typeof node[param].value !== 'undefined') {
              setParamSmoothly(node[param], value);
            } else {
              node.set({ [param]: value });
            }
          } catch (e) { console.warn(`'${pluginDef.type}' için '${param}' güncellenemedi:`, e); }
        },
        dispose: () => node.dispose(),
      };
    },

    Compressor: (fxData, pluginDef) => {
      const compressor = new Tone.Compressor(fxData.settings);
      
      return {
        input: compressor,
        output: compressor,
        sidechainInput: compressor, // For potential sidechaining
        updateParam: (param, value) => {
          try {
            if (param !== 'sidechainSource') {
              if (compressor[param] && typeof compressor[param].value !== 'undefined') {
                setParamSmoothly(compressor[param], value);
              } else {
                compressor.set({ [param]: value });
              }
            }
          } catch (e) { console.warn(`'${pluginDef.type}' için '${param}' güncellenemedi:`, e); }
        },
        dispose: () => {
          compressor.dispose();
        },
      };
    },
    
    // REHBER ADIM 5: MultiBand builder'ı granüler güncellemeleri destekleyecek şekilde güncellendi.
    MultiBand: (fxData, pluginDef) => {
      const bandNodes = new Map();
      const input = new Tone.Gain();
      const output = new Tone.Gain();
      let lastNode = input;
      
      (fxData.settings.bands || []).forEach(band => {
        const filter = new Tone.BiquadFilter({
            frequency: band.frequency, gain: band.gain, Q: band.q, type: band.type,
        });
        
        lastNode.connect(filter);
        lastNode = filter;

        // Bandı ID'si ile Map'e kaydediyoruz ki kolayca bulabilelim.
        bandNodes.set(band.id, filter);
        
        if (!band.active) {
          filter.type = 'allpass';
          filter.gain.value = 0;
        }
      });
      lastNode.connect(output);
      
      return {
        input: input,
        output: output,
        // Bu fonksiyon artık tüm bandları tek seferde güncelliyor.
        updateParam: (param, value) => {
            if (param === 'bands' && Array.isArray(value)) {
                value.forEach((bandData) => {
                    const nodeToUpdate = bandNodes.get(bandData.id);
                    if (nodeToUpdate && bandData) {
                        if (nodeToUpdate.frequency.value !== bandData.frequency) nodeToUpdate.frequency.rampTo(bandData.frequency, 0.01);
                        if (nodeToUpdate.gain.value !== bandData.gain) nodeToUpdate.gain.rampTo(bandData.gain, 0.01);
                        if (nodeToUpdate.Q.value !== bandData.q) nodeToUpdate.Q.value = bandData.q;
                    }
                });
            }
        },
        // YENİ: Tek bir bandın tek bir parametresini güncelleyen fonksiyon.
        updateBandParam: (bandId, param, value) => {
          const node = bandNodes.get(bandId);
          if (node) {
            if (node[param] && typeof node[param].value !== 'undefined') {
              setParamSmoothly(node[param], value);
            } else {
              console.warn(`MultiBand EQ: Geçersiz parametre '${param}'`);
            }
          }
        },
        dispose: () => {
            input.dispose();
            output.dispose();
            bandNodes.forEach(node => node.dispose());
        },
      };
    },

    SidechainCompressor: (fxData, pluginDef) => {
      const compressor = new Tone.Compressor(fxData.settings);
      const sidechainInput = new Tone.Gain();
      sidechainInput.connect(compressor.sidechain);

      return {
        input: compressor,
        output: compressor,
        sidechainInput: sidechainInput,
        updateParam: (param, value) => {
          try {
            if (param === 'sidechainSource') return;
            if (compressor[param] && typeof compressor[param].value !== 'undefined') {
              setParamSmoothly(compressor[param], value);
            } else {
              compressor.set({ [param]: value });
            }
          } catch (e) { console.warn(`'${pluginDef.type}' için '${param}' güncellenemedi:`, e); }
        },
        dispose: () => {
          compressor.dispose();
          sidechainInput.dispose();
        },
      };
    },

    AtmosChain: (fxData, pluginDef) => {
      const { size, movement, width, character, wet } = fxData.settings;
      
      const input = new Tone.Gain();
      const output = new Tone.Gain();
      const panner = new Tone.AutoPanner(`${movement * 5}n`).start();
      const reverb = new Tone.Reverb(size * 4);
      const vibrato = new Tone.Vibrato(movement * 10, character * 0.5);
      const stereoWidener = new Tone.StereoWidener(width);
      const wetDry = new Tone.WetDry(wet);

      // Sinyal Zinciri: input -> vibrato -> panner -> reverb -> stereoWidener -> wet -> output
      input.chain(vibrato, panner, reverb, stereoWidener, wetDry, output);
      input.connect(wetDry.dry); // Dry sinyali de bağla

      return {
        input: input,
        output: output,
        updateParam: (param, value) => {
          try {
            switch(param) {
              case 'size': reverb.decay = value * 4; break;
              case 'movement': panner.frequency.value = value * 5; vibrato.frequency.value = value * 10; break;
              case 'width': stereoWidener.width.value = value; break;
              case 'character': vibrato.depth.value = value * 0.5; break;
              case 'wet': wetDry.wet.value = value; break;
            }
          } catch (e) { console.warn(`'AtmosMachine' için '${param}' güncellenemedi:`, e); }
        },
        dispose: () => {
          [input, output, panner, reverb, vibrato, stereoWidener, wetDry].forEach(n => n.dispose());
        },
      };
    },
  }
};