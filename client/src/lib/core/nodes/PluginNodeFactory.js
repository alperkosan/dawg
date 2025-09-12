import * as Tone from 'tone';
import { pluginRegistry } from '../../../config/pluginConfig';

/**
 * Gelen tanıma göre basit veya karmaşık Tone.js ses düğümleri (efektler) oluşturan fabrika.
 */
export const PluginNodeFactory = {
  create(fxData) {
    const pluginDef = pluginRegistry[fxData.type];
    if (!pluginDef) return null;
    
    // Eğer bu plugin için özel bir "builder" metodu varsa onu, yoksa varsayılanı kullan.
    const builder = this.builders[pluginDef.toneNode] || this.builders.default;
    return builder(fxData, pluginDef);
  },

  // Builder (inşa edici) metotlar
  builders: {
    /** Varsayılan builder: Tone.js'te doğrudan karşılığı olan basit efektler için. */
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
            if (node[param] && typeof node[param].value !== 'undefined') node[param].value = value;
            else node.set({ [param]: value });
          } catch (e) { console.warn(`'${pluginDef.type}' için '${param}' güncellenemedi:`, e); }
        },
        dispose: () => node.dispose(),
      };
    },

    Compressor: (fxData, pluginDef) => {
      // Standart Tone.js Compressor'ünü oluştur.
      const compressor = new Tone.Compressor(fxData.settings);
      
      return {
        // Ana ses sinyali doğrudan compressor'ün giriş ve çıkışından geçer.
        input: compressor,
        output: compressor,
        
        // Sidechain sinyalinin bağlanacağı kapı, compressor'ün kendisidir.
        // Bu sayede dışarıdan bir sinyal doğrudan bu compressor'ü tetikleyebilir.
        sidechainInput: compressor,
        
        updateParam: (param, value) => {
          try {
            if (param !== 'sidechainSource') {
              if (compressor[param] && typeof compressor[param].value !== 'undefined') {
                compressor[param].value = value;
              } else {
                compressor.set({ [param]: value });
              }
            }
          } catch (e) { console.warn(`'${pluginDef.type}' için '${param}' güncellenemedi:`, e); }
        },
        // 'sidechainInput' artık compressor'ün kendisi olduğu için,
        // sadece compressor'ü dispose etmemiz yeterli.
        dispose: () => {
          compressor.dispose();
        },
      };
    },

    /** MultiBandEQ gibi birden fazla düğümden oluşan özel efektler için. */
    MultiBand: (fxData, pluginDef) => {
      const bandNodes = [];
      const input = new Tone.Gain();
      const output = new Tone.Gain();
      let lastNode = input;
      
      (fxData.settings.bands || []).forEach(band => {
        const filter = new Tone.BiquadFilter({
            frequency: band.frequency, gain: band.gain, Q: band.q, type: band.type,
        });
        
        // Bandı zincire bağla
        lastNode.connect(filter);
        lastNode = filter;

        // Bandı ID ile sakla (eğer ID yoksa index kullan)
        bandNodes.push({ id: band.id || bandNodes.length, node: filter });
        
        // Eğer band pasif ise, by-pass et (sesi doğrudan geçir)
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
            // "bands.1.gain" veya "bands" (tüm bantları değiştirmek için)
            if (param === 'bands') {
                // Preset değişikliği gibi durumlarda tüm zinciri yeniden oluşturmak daha güvenli olabilir.
                // Bu şimdilik mevcut sync mekanizmasına bırakılmıştır.
                return; 
            }
            const [, bandIndex, bandParam] = param.split('.');
            const bandToUpdate = bandNodes[bandIndex];
            if (bandToUpdate && bandToUpdate.node) {
                // Aktif/pasif durumunu kontrol et
                if(bandParam === 'active') {
                    if (value) { // Aktif ediliyor
                        const originalSettings = fxData.settings.bands[bandIndex];
                        bandToUpdate.node.type = originalSettings.type;
                        bandToUpdate.node.gain.value = originalSettings.gain;
                    } else { // Pasif ediliyor
                        bandToUpdate.node.type = 'allpass';
                        bandToUpdate.node.gain.value = 0;
                    }
                } else if (bandToUpdate.node[bandParam] && typeof bandToUpdate.node[bandParam].value !== 'undefined') {
                    bandToUpdate.node[bandParam].value = value;
                } else {
                    bandToUpdate.node.set({ [bandParam]: value });
                }
            }
        },
        dispose: () => {
            input.dispose();
            output.dispose();
            bandNodes.forEach(b => b.node.dispose());
        },
      };
    },
    
    // ... (AtmosChain, GhostLFOChain, SampleManipulator gibi diğer tüm özel builder'lar buraya eklenebilir) ...
  }
};