/**
 * @file AudioContextService.js
 * @description Projenin herhangi bir yerinden ses motoruna erişmek için kullanılan
 * merkezi, singleton bir servis. "Prop drilling" sorununu tamamen çözer.
 * Bu sürüm, AudioEngine'in tüm public arayüzünü bir "proxy" olarak içerir.
 * REHBER ADIM 4.2'ye göre güncellenmiştir.
 */
export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  }
  
  static setAudioEngine(engine) {
    this.audioEngine = engine;
    console.log("✅ AudioContextService: Ses motoru başarıyla kaydedildi.");
  }
  
  static getAudioEngine() {
    if (!this.audioEngine) {
        console.warn("AudioContextService: Ses motoru henüz hazır değil veya kaydedilmemiş!");
    }
    return this.audioEngine;
  }
  
  // =========================================================================
  // === AudioEngine Proxy Metotları ===
  // =========================================================================
  
  // --- Mevcut Metotlar ---
  static fullSync(...args) { this.getAudioEngine()?.fullSync(...args); }
  static createInstrument(...args) { this.getAudioEngine()?.createInstrument(...args); }
  static removeInstrument(...args) { this.getAudioEngine()?.removeInstrument(...args); }
  static updateInstrumentParameters(...args) { this.getAudioEngine()?.updateInstrumentParameters(...args); }
  static reconcileInstrument(...args) { return this.getAudioEngine()?.reconcileInstrument(...args); }
  static async requestInstrumentBuffer(...args) { return await this.getAudioEngine()?.requestInstrumentBuffer(...args); }
  static rebuildSignalChain(...args) { this.getAudioEngine()?.rebuildSignalChain(...args); }
  static updateMixerParam(...args) { this.getAudioEngine()?.updateMixerParam(...args); }
  static updateEffectParam(...args) { this.getAudioEngine()?.updateEffectParam(...args); }
  static updateSendLevel(...args) { this.getAudioEngine()?.updateSendLevel(...args); }
  static setMuteState(...args) { this.getAudioEngine()?.setMuteState(...args); }
  static setSoloState(...args) { this.getAudioEngine()?.setSoloState(...args); }
  static setInstrumentMute(...args) { this.getAudioEngine()?.setInstrumentMute(...args); }
  static reschedule(...args) { this.getAudioEngine()?.reschedule(...args); }
  static start(...args) { this.getAudioEngine()?.start(...args); }
  static resume(...args) { this.getAudioEngine()?.resume(...args); }
  static stop(...args) { this.getAudioEngine()?.stop(...args); }
  static pause(...args) { this.getAudioEngine()?.pause(...args); }
  static setBpm(...args) { this.getAudioEngine()?.setBpm(...args); }
  static jumpToBar(...args) { this.getAudioEngine()?.jumpToBar(...args); }
  static jumpToStep(...args) { this.getAudioEngine()?.jumpToStep(...args); }
  static updateLoopRange(...args) { this.getAudioEngine()?.updateLoopRange(...args); }
  static auditionNoteOn(...args) { this.getAudioEngine()?.auditionNoteOn(...args); }
  static auditionNoteOff(...args) { this.getAudioEngine()?.auditionNoteOff(...args); }
  static updateEffectBandParam(...args) { this.getAudioEngine()?.updateEffectBandParam(...args); }

  // REHBER ADIM 4.2: Yeni EQ Kontrol Fonksiyonları Eklendi [cite: 435-455]
  /**
   * Bir kanalın EQ bandını günceller.
   * @param {string} trackId Kanal ID'si
   * @param {string} band 'hi', 'hiMid', 'loMid', 'lo'
   * @param {string} param 'gain', 'frequency', 'q'
   * @param {number} value Yeni değer
   */
  static updateChannelEQ(trackId, band, param, value) {
    this.getAudioEngine()?.updateChannelEQ(trackId, band, param, value);
  }

  /**
   * Bir kanalın EQ ayarlarını sıfırlar.
   * @param {string} trackId Kanal ID'si
   */
  static resetChannelEQ(trackId) {
    this.getAudioEngine()?.resetChannelEQ(trackId);
  }

  /**
   * Master kanalının EQ bandını günceller.
   * @param {string} band 'hi', 'hiMid', 'loMid', 'lo'
   * @param {string} param 'gain', 'frequency', 'q'
   * @param {number} value Yeni değer
   */
  static updateMasterEQ(band, param, value) {
    this.getAudioEngine()?.updateMasterEQ(band, param, value);
  }
}
