// src/lib/core/nodes/MixerStrip.js - FAZ 1 ENTEGRASYONU (Worklet Tabanlı Metering)

/**
 * @file MixerStrip.js
 * @description DAW (Dijital Ses İşleme İstasyonu) içindeki her bir mikser kanalını (track, bus, master)
 * temsil eden ve ses sinyal zincirini yöneten temel sınıf. Bu sınıf, Tone.js'in eski analiz araçları
 * yerine, ses thread'inde çalışan yüksek performanslı AudioWorklet'leri kullanarak modern bir
 * yaklaşım benimser.
 */

// Gerekli Tone.js modüllerini ve kendi servislerimizi import ediyoruz.
import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService'; // Pasif hale getirdiğimiz merkezi ölçümleme servisimiz.
import { setParamSmoothly } from '../../utils/audioUtils';
import { MIXER_TRACK_TYPES } from '../../../config/constants'; // Proje genelindeki sabitler.

export class MixerStrip {
  /**
   * Yeni bir mikser kanalı oluşturur.
   * @param {object} trackData - Kanalın başlangıç verilerini içeren obje (örn: ID, isim, volume).
   * @param {WorkletManager} workletManager - Projedeki AudioWorklet'leri yöneten merkezi servis.
   */
  constructor(trackData, workletManager) {
    // --- TEMEL ÖZELLİKLER ---
    this.id = trackData.id;
    this.type = trackData.type;
    this.trackData = trackData;
    this.workletManager = workletManager; // Worklet oluşturmak için gerekli yönetici.
    this.isDisposed = false; // Kanalın silinip silinmediğini takip eder.

    // --- TEMEL SES DÜĞÜMLERİ (AUDIO NODES) ---
    // Her enstrümandan veya başka kanaldan gelen sesin ilk girdiği nokta.
    this.inputGain = new Tone.Gain(1);
    // Kanalın sinyal zincirinden çıkan sesin en son geçtiği nokta.
    this.outputGain = new Tone.Gain(1);

    // --- SES KONTROL DÜĞÜMLERİ ---
    // Kanalın ses seviyesini ayarlar.
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    // Stereo alanındaki pozisyonu ayarlar (master kanalı hariç).
    this.panner = this.type !== MIXER_TRACK_TYPES.MASTER ? new Tone.Panner(trackData.pan || 0) : null;
    // Mute (Susturma) işlemini yöneten Gain düğümü.
    this.muteGain = new Tone.Gain(1);
    // Solo (Yalnız Çalma) işlemini yöneten Gain düğümü.
    this.soloGain = new Tone.Gain(1);

    // --- ÖLÇÜMLEME (METERING) ---
    // Ses thread'inde çalışacak olan ve ana thread'e veri gönderecek olan Worklet'imiz.
    this.meteringNode = null;
    // Worklet'ten gelen en son ölçüm verisini saklarız, böylece UI'a sürekli taze veri gönderebiliriz.
    this._lastMeterData = { db: -144, peak: 0, rms: 0, fft: null, waveform: null };
    // UI animasyon döngüsünün ID'sini tutar, böylece temizlik (dispose) sırasında durdurabiliriz.
    this.meteringAnimationFrameId = null;

    // --- EFEKTLER VE YÖNLENDİRME ---
    // Kanala eklenen insert efektlerinin ses düğümlerini (Tone.js objeleri) saklar.
    this.effectNodes = new Map();
    // Kanaldan diğer bus kanallarına gönderilen "send" bağlantılarını saklar.
    this.sendNodes = new Map();

    // Bu Promise, meteringNode'un asenkron olarak oluşturulup hazır olmasını bekler.
    // Bu sayede, sinyal zincirini kurmadan önce metering'in hazır olduğundan emin oluruz.
    this.readyPromise = this._initializeMeteringNode();
  }

  /**
   * Kanal için gerekli olan `analysis-processor` AudioWorklet'ini asenkron olarak oluşturur ve ayarlar.
   * @private
   */
  async _initializeMeteringNode() {
    if (!this.workletManager) {
      console.error(`[MixerStrip:${this.id}] WorkletManager sağlanmadı. Ölçümleme devre dışı.`);
      return;
    }

    try {
      // WorkletManager'dan yeni bir 'analysis-processor' Worklet'i oluşturmasını istiyoruz.
      const { node } = await this.workletManager.createWorkletNode('analysis-processor', {
        processorOptions: { channelId: this.id } // Worklet'e hangi kanala ait olduğunu bildiriyoruz.
      });
      this.meteringNode = node;

      // Worklet'ten gelecek mesajları dinlemek için bir 'onmessage' olayı atıyoruz.
      this.meteringNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        // Eğer mesaj tipi 'meteringData' ise, gelen veriyi saklıyoruz.
        if (type === 'meteringData') {
          this._lastMeterData = data;
        }
      };
    } catch (error) {
      console.error(`[MixerStrip:${this.id}] Metering worklet'i oluşturulamadı:`, error);
    }
  }

  /**
   * Kanalın tüm ses sinyal zincirini (efektler, fader, panner vb.) sıfırdan kurar.
   * Bu fonksiyon, bir efekt eklendiğinde/çıkarıldığında veya kanalın çıkışı değiştirildiğinde çağrılır.
   * @param {object} trackData - Kanalın en güncel verileri.
   * @param {Tone.Gain} masterInput - Master kanalının giriş düğümü.
   * @param {Map<string, Tone.Gain>} busInputs - Diğer tüm bus kanallarının giriş düğümleri.
   */
  async buildSignalChain(trackData, masterInput, busInputs) {
    // Metering worklet'inin yüklenmesini bekler. Bu, zincirin eksik kurulmasını engeller.
    await this.readyPromise;

    this.trackData = trackData;
    if (this.isDisposed || !this.meteringNode) return;

    // Mevcut tüm bağlantıları temizleyerek zinciri sıfırlıyoruz.
    this.inputGain.disconnect();
    this.clearChain(); // Efektler gibi alt zincirleri temizler.

    // Sinyal zincirini bir dizi olarak başlatıyoruz. İlk eleman her zaman kanalın girişidir.
    const mainSignalChain = [this.inputGain];

    // 1. INSERT EFEKTLERİNİ ZİNCİRE EKLEME
    (trackData.insertEffects || []).forEach(fxData => {
      // Eğer efekt 'bypass' (devre dışı) değilse zincire ekle.
      if (!fxData.bypass) {
        const fxNode = PluginNodeFactory.create(fxData);
        if (fxNode) {
          mainSignalChain.push(fxNode.input);
          // Bazı efektlerin giriş ve çıkış düğümleri farklı olabilir.
          if (fxNode.input !== fxNode.output) mainSignalChain.push(fxNode.output);
          this.effectNodes.set(fxData.id, fxNode);
        }
      }
    });

    // 2. PANNER VE FADER'I ZİNCİRE EKLEME (Master hariç)
    if (this.panner) mainSignalChain.push(this.panner);
    mainSignalChain.push(this.fader);

    // Tone.connectSeries ile tüm düğümleri sırayla birbirine bağlıyoruz.
    Tone.connectSeries(...mainSignalChain);

    // 3. SEND BAĞLANTILARINI OLUŞTURMA
    // Send'ler, fader'dan ÖNCE (pre-fader) veya SONRA (post-fader) alınabilir.
    // Biz burada post-fader bir yapı kuruyoruz, yani sinyal fader'dan sonra send'lere gider.
    this.setupSends(trackData.sends || [], this.fader, busInputs);

    // 4. SOLO, MUTE VE METERING DÜĞÜMLERİNİ BAĞLAMA
    this.fader.connect(this.soloGain);
    this.soloGain.connect(this.muteGain);
    // Sinyal, susturulduktan sonra ölçümleme için meteringNode'a gider.
    this.muteGain.connect(this.meteringNode);
    // Ölçümlenen sinyal, son olarak kanalın çıkışına (outputGain) gider.
    this.meteringNode.connect(this.outputGain);

    // 5. KANALIN ÇIKIŞINI DOĞRU YERE YÖNLENDİRME
    this.setupOutputRouting(trackData, masterInput, busInputs);

    // 6. UI GÜNCELLEMESİ İÇİN METERING DÖNGÜSÜNÜ BAŞLATMA
    this.setupMetering();
  }

  /**
   * Kanalın çıkışını (outputGain) doğru hedefe (master veya bir bus kanalı) bağlar.
   */
  setupOutputRouting(trackData, masterInput, busInputs) {
    this.outputGain.disconnect();
    if (this.type === MIXER_TRACK_TYPES.MASTER) {
      this.outputGain.toDestination(); // Master kanalı doğrudan ses kartının çıkışına bağlanır.
      return;
    }
    const customOutput = trackData.output;
    // Eğer özel bir çıkış (bir bus kanalı) tanımlanmışsa oraya, değilse master'a bağlanır.
    if (customOutput && busInputs.has(customOutput)) {
      this.outputGain.connect(busInputs.get(customOutput));
    } else {
      this.outputGain.connect(masterInput);
    }
  }

  /**
   * Kanalın "send" yönlendirmelerini ayarlar.
   */
  setupSends(sendsData, sourceNode, busInputs) {
    sendsData.forEach(send => {
      const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
      sourceNode.connect(sendGain); // Sinyali ana zincirden alır.
      const targetBusInput = busInputs.get(send.busId);
      if (targetBusInput) {
        sendGain.connect(targetBusInput); // Hedef bus kanalına gönderir.
      }
      this.sendNodes.set(send.busId, sendGain);
    });
  }

  /**
   * UI'ın güncellenmesi için `MeteringService`'e periyodik olarak veri gönderecek döngüyü başlatır.
   */
  setupMetering() {
    this.clearMetering(); // Önceki döngüyü temizle.
    const outputMeterId = `${this.id}-output`;

    const meteringLoop = () => {
      if (this.isDisposed) return; // Eğer kanal silinmişse döngüyü durdur.

      // Worklet'ten gelen en son veriyi `MeteringService` aracılığıyla yayınla.
      // İlgili UI bileşenleri (örn: LevelMeterV2) bu veriyi alıp kendilerini günceller.
      MeteringService.publish(outputMeterId, this._lastMeterData.db);
      
      // Döngünün bir sonraki karede tekrar çalışmasını iste.
      this.meteringAnimationFrameId = requestAnimationFrame(meteringLoop);
    };
    meteringLoop();
  }
  
  // --- KANAL KONTROL FONKSİYONLARI ---

  /**
   * Kanalın ses seviyesi veya pan değeri gibi temel bir parametresini günceller.
   */
  updateParam(param, value) {
    if (this.isDisposed) return;
    try {
      if (param === 'volume') setParamSmoothly(this.fader.volume, value, 0.02);
      else if (param === 'pan' && this.panner) setParamSmoothly(this.panner.pan, value, 0.02);
    } catch (error) {
      console.error(`[MixerStrip:${this.id}] Parametre güncellenemedi (${param}):`, error);
    }
  }

  /**
   * Bir insert efektinin belirli bir parametresini günceller.
   */
  updateEffectParam(effectId, paramOrSettings, value) {
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateParam) {
      try {
        if (typeof paramOrSettings === 'string') {
          effectNode.updateParam(paramOrSettings, value);
        } else {
          // Eğer bir obje geldiyse (preset değişikliği gibi), tüm ayarları tek seferde uygula.
          Object.entries(paramOrSettings).forEach(([p, v]) => effectNode.updateParam(p, v));
        }
      } catch (error) {
        console.error(`[MixerStrip:${this.id}] Efekt parametresi güncellenemedi (${effectId}):`, error);
      }
    }
  }

  // (Diğer update metodları, setSolo, setMute... benzer şekilde çalışır)

  // --- TEMİZLİK FONKSİYONLARI ---

  /**
   * Kanal silindiğinde (dispose) veya sinyal zinciri yeniden kurulacağında çağrılır.
   * Tüm animasyon döngülerini ve alt düğümleri temizler.
   */
  clearMetering() {
    if (this.meteringAnimationFrameId) {
      cancelAnimationFrame(this.meteringAnimationFrameId);
      this.meteringAnimationFrameId = null;
    }
  }

  /**
   * Tüm efekt ve send düğümlerini zincirden kaldırır ve temizler.
   */
  clearChain() {
    this.clearMetering();
    this.sendNodes.forEach(node => node.dispose());
    this.sendNodes.clear();
    this.effectNodes.forEach(node => node.dispose());
    this.effectNodes.clear();
  }

  /**
   * Kanalı tamamen yok eder ve tüm Web Audio kaynaklarını serbest bırakır.
   */
  dispose() {
    this.isDisposed = true;
    this.clearChain();
    // Worklet'in port'unu kapatmak önemlidir.
    this.meteringNode?.port.close();
    // Kanal tarafından oluşturulan tüm ana Tone.js düğümlerini yok et.
    [this.inputGain, this.panner, this.fader, this.outputGain, this.soloGain, this.muteGain]
      .forEach(node => node?.dispose());
    console.log(`🗑️ MixerStrip disposed: ${this.id}`);
  }
}