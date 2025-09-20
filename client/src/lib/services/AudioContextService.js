/**
 * @file AudioContextService.js
 * @description Projenin herhangi bir yerinden ses motoruna erişmek için kullanılan
 * merkezi, singleton bir servis. "Prop drilling" sorununu tamamen çözer.
 * Bu sürüm, AudioEngine'in tüm public arayüzünü bir "proxy" olarak içerir.
 */
export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  
  /**
   * Servisin tek bir örneğini (singleton instance) döndürür.
   * @returns {AudioContextService}
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  }
  
  /**
   * Ses motorunu servise kaydeder. Bu fonksiyon sadece App.jsx'te bir kere çağrılmalıdır.
   * @param {import('../core/AudioEngine').default} engine - Ses motorunun örneği.
   */
  static setAudioEngine(engine) {
    this.audioEngine = engine;
    console.log("✅ AudioContextService: Ses motoru başarıyla kaydedildi.");
  }
  
  /**
   * Kayıtlı ses motorunu döndürür. Eğer motor henüz hazır değilse null dönebilir.
   * @returns {import('../core/AudioEngine').default | null}
   */
  static getAudioEngine() {
    if (!this.audioEngine) {
        console.warn("AudioContextService: Ses motoru henüz hazır değil veya kaydedilmemiş!");
    }
    return this.audioEngine;
  }
  
  // =========================================================================
  // === AudioEngine Proxy Metotları ===
  // =========================================================================
  // Aşağıdaki tüm metotlar, AudioEngine sınıfındaki public metotların birer
  // yansımasıdır. Gelen tüm argümanları doğrudan gerçek motora iletirler.

  /**
   * Projenin tüm verilerini (enstrümanlar, mikser, aranjman) alıp ses motorunu sıfırdan kurar.
   * @param {...any} args - AudioEngine.fullSync metodunun argümanları.
   */
  static fullSync(...args) { this.getAudioEngine()?.fullSync(...args); }

  /**
   * Yeni bir enstrüman oluşturur ve ses motoruna ekler.
   * @param {object} instData - Yeni enstrümanın konfigürasyon verisi.
   */
  static createInstrument(...args) { this.getAudioEngine()?.createInstrument(...args); }

  /**
   * Bir enstrümanı ses motorundan kaldırır.
   * @param {string} instrumentId - Kaldırılacak enstrümanın ID'si.
   */
  static removeInstrument(...args) { this.getAudioEngine()?.removeInstrument(...args); }

  /**
   * Bir enstrümanın anlık parametrelerini (örn: envelope) günceller.
   * @param {string} instrumentId - Güncellenecek enstrümanın ID'si.
   * @param {object} updatedInstrumentData - Yeni parametreler.
   */
  static updateInstrumentParameters(...args) { this.getAudioEngine()?.updateInstrumentParameters(...args); }

  /**
   * Bir enstrümanın ses verisini (buffer) kalıcı olarak değiştirir (örn: reverse, normalize).
   * @param {string} instrumentId - İşlem yapılacak enstrümanın ID'si.
   * @param {object} updatedInstData - Uygulanacak değişiklikleri içeren veri.
   * @returns {Tone.ToneAudioBuffer | null} - İşlenmiş yeni buffer.
   */
  static reconcileInstrument(...args) { return this.getAudioEngine()?.reconcileInstrument(...args); }

  /**
   * Bir enstrümanın ham ses verisini (buffer) ister. Sample Editor gibi araçlar için kullanılır.
   * @param {string} instrumentId - Buffer'ı istenen enstrümanın ID'si.
   * @returns {Promise<Tone.ToneAudioBuffer | null>} - İstenen buffer'ı içeren bir Promise.
   */
  static async requestInstrumentBuffer(...args) { return await this.getAudioEngine()?.requestInstrumentBuffer(...args); }
  
  /**
   * Bir mikser kanalının sinyal zincirini (efektler, send'ler vs.) yeniden kurar.
   * @param {string} trackId - Yeniden kurulacak kanalın ID'si.
   * @param {object} trackData - Kanalın güncel verisi.
   */
  static rebuildSignalChain(...args) { this.getAudioEngine()?.rebuildSignalChain(...args); }

  /**
   * Bir mikser kanalının temel parametresini (volume, pan) günceller.
   * @param {string} trackId - Kanal ID'si.
   * @param {string} param - 'volume' veya 'pan'.
   * @param {number} value - Yeni değer.
   */
  static updateMixerParam(...args) { this.getAudioEngine()?.updateMixerParam(...args); }

  /**
   * Bir mikser kanalındaki bir efektin parametresini günceller.
   * @param {string} trackId - Kanal ID'si.
   * @param {string} effectId - Efekt ID'si.
   * @param {string|object} paramOrSettings - Güncellenecek parametrenin adı veya ayarlar nesnesi.
   * @param {any} value - Yeni değer.
   */
  static updateEffectParam(...args) { this.getAudioEngine()?.updateEffectParam(...args); }

  /**
   * Bir send kanalının ses seviyesini günceller.
   * @param {string} trackId - Ana kanalın ID'si.
   * @param {string} busId - Hedef bus'ın ID'si.
   * @param {number} level - Yeni ses seviyesi (dB).
   */
  static updateSendLevel(...args) { this.getAudioEngine()?.updateSendLevel(...args); }

  /**
   * Bir kanalın Mute (sessize alma) durumunu ayarlar.
   * @param {string} trackId - Kanal ID'si.
   * @param {boolean} isMuted - Sessize alınıp alınmayacağı.
   */
  static setMuteState(...args) { this.getAudioEngine()?.setMuteState(...args); }
  
  /**
   * Projedeki tüm Solo durumlarını yönetir.
   * @param {Set<string>} soloedChannels - Solo yapılan kanalların ID'lerini içeren Set.
   */
  static setSoloState(...args) { this.getAudioEngine()?.setSoloState(...args); }

  /**
   * Bir enstrümanı doğrudan Mute yapar (mikser kanalı üzerinden).
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {boolean} isMuted - Sessize alınıp alınmayacağı.
   */
  static setInstrumentMute(...args) { this.getAudioEngine()?.setInstrumentMute(...args); }
  
  /**
   * Çalma listesindeki tüm notaları yeniden zamanlar.
   */
  static reschedule(...args) { this.getAudioEngine()?.reschedule(...args); }

  /**
   * Çalmayı başlatır. Opsiyonel olarak bir başlangıç adımı alabilir.
   * @param {number} [startStep=0] - Çalmanın başlayacağı 16'lık nota adımı.
   */
  static start(...args) { this.getAudioEngine()?.start(...args); }

  /**
   * Duraklatılmış çalmayı devam ettirir.
   */
  static resume(...args) { this.getAudioEngine()?.resume(...args); }

  /**
   * Çalmayı durdurur ve başa sarar.
   */
  static stop(...args) { this.getAudioEngine()?.stop(...args); }

  /**
   * Çalmayı duraklatır.
   */
  static pause(...args) { this.getAudioEngine()?.pause(...args); }
  

  /**
   * Projenin BPM'ini (tempo) değiştirir.
   * @param {number} newBpm - Yeni BPM değeri.
   */
  static setBpm(...args) { this.getAudioEngine()?.setBpm(...args); }

  /**
   * Belirtilen bar numarasına atlar.
   * @param {number} barNumber - Gidilecek bar numarası.
   */
  static jumpToBar(...args) { this.getAudioEngine()?.jumpToBar(...args); }

  /**
   * Belirtilen step'e atlar.
   * @param {number} step - Gidilecek step (16'lık nota) numarası.
   */
  static jumpToStep(...args) { this.getAudioEngine()?.jumpToStep(...args); }

  /**
   * YENİ: Çalma döngüsünün başlangıç ve bitiş noktalarını günceller.
   */
  static updateLoopRange(...args) { this.getAudioEngine()?.updateLoopRange(...args); }

  /**
   * Bir notayı anlık olarak dinlemek için çalar (tuşa basma).
   * @param {string} id - Enstrüman ID'si.
   * @param {string} pitch - Nota (örn: 'C4').
   * @param {number} vel - Velocity (0-1 arası).
   */
  static auditionNoteOn(...args) { this.getAudioEngine()?.auditionNoteOn(...args); }

  /**
   * Dinlenen notayı susturur (tuştan çekme).
   * @param {string} id - Enstrüman ID'si.
   * @param {string} pitch - Nota.
   */
  static auditionNoteOff(...args) { this.getAudioEngine()?.auditionNoteOff(...args); }
}
