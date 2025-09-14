import * as Tone from 'tone';
import { pluginRegistry } from '../../../config/pluginConfig';
// YENİ: setParamSmoothly fonksiyonunu import ediyoruz
import { setParamSmoothly } from '../../utils/audioUtils';

/**
 * Gelen tanıma göre basit veya karmaşık Tone.js ses düğümleri (efektler) oluşturan fabrika.
 */
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
            // GÜNCELLENDİ: Doğrudan atama yerine yumuşak geçiş fonksiyonu kullanılıyor.
            if (node[param] && typeof node[param].value !== 'undefined') {
              setParamSmoothly(node[param], value);
            } else {
              // `set` metodu genellikle rampa gerektirmeyen ayarlar içindir.
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
        sidechainInput: compressor,
        updateParam: (param, value) => {
          try {
            if (param !== 'sidechainSource') {
              // GÜNCELLENDİ: Doğrudan atama yerine yumuşak geçiş fonksiyonu kullanılıyor.
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
    
    // MultiBand builder'ı zaten rampTo kullandığı için değişikliğe gerek yok.
    MultiBand: (fxData, pluginDef) => {
      const bandNodes = [];
      const input = new Tone.Gain();
      const output = new Tone.Gain();
      let lastNode = input;
      
      (fxData.settings.bands || []).forEach(band => {
        const filter = new Tone.BiquadFilter({
            frequency: band.frequency, gain: band.gain, Q: band.q, type: band.type,
        });
        
        lastNode.connect(filter);
        lastNode = filter;

        bandNodes.push({ id: band.id || bandNodes.length, node: filter });
        
        if (!band.active) {
          filter.type = 'allpass';
          filter.gain.value = 0;
        }
      });
      lastNode.connect(output);
      
      return {
        input: input,
        output: output,
        updateParam: (param, value) => {
            if (param === 'bands' && Array.isArray(value)) {
                value.forEach((bandData, index) => {
                    const bandToUpdate = bandNodes[index];
                    if (bandToUpdate && bandToUpdate.node && bandData) {
                        const node = bandToUpdate.node;
                        
                        if (node.frequency.value !== bandData.frequency) {
                            node.frequency.rampTo(bandData.frequency, 0.01);
                        }
                        if (node.gain.value !== bandData.gain) {
                            node.gain.rampTo(bandData.gain, 0.01);
                        }
                        if (node.Q.value !== bandData.q) {
                            node.Q.value = bandData.q;
                        }
                    }
                });
            }
        },
        dispose: () => {
            input.dispose();
            output.dispose();
            bandNodes.forEach(b => b.node.dispose());
        },
      };
    },
  }
};