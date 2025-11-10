# 🧠 Gemini Master Plan - Proje Beyni

Bu doküman, DAWG projesinde geliştirme yaparken benim (Gemini) için birincil referans kaynağıdır. Projenin vizyonunu, mimarisini, kurallarını ve mevcut durumunu özetler. Her oturumun başında, projeye hızla adapte olmak için bu dosyayı referans alacağım.

---

## 🎯 1. Proje Vizyonu ve Felsefesi

- **Ana Vizyon:** "Endüstri standardı ses işleme yeteneklerine ve modern web kullanıcı deneyimine sahip profesyonel bir DAW."
- **Plugin Felsefesi:** "Tek Düğme, Sonsuz Olasılık" (Mode-Based Design). Karmaşıklığı gizle, gücü ortaya çıkar. Kullanıcıya senaryo bazlı modlar sun, tek bir ana kontrol ile yönetmesini sağla ve ileri düzey ayarları gizle.
- **Tasarım Felsefesi (Zenith):** Netlik, sese duyarlı geri bildirim, profesyonel derinlik ve performansı ön planda tutan bir görsel dil.

---

## 📊 2. Mevcut Durum (Snapshot)

- **Plugin İlerlemesi:** 14 plugin'den 6'sı tamamlandı (%43).
- **Mimari Puanı:** 8.5/10. Güçlü yönler: `PlaybackController`, `UIUpdateManager`, `EventBus`. İyileştirilecekler: Bağımsız bir RAF döngüsü var ve merkezi bir debug logger sistemi eksik.
- **Teknoloji Yığını:** React 18, Vite, Zustand, Web Audio API, AudioWorklet, Canvas API.
- **Tasarım Sistemi:** Zenith Design System.

---

## 🏗️ 3. Temel Mimari Desenler (Architecture Patterns)

Kod yazarken bu desenlere harfiyen uymalıyım.

1.  **`PlaybackController` (Singleton):**
    - **Dosya:** `lib/core/PlaybackController.js`
    - **Prensip:** Oynatma durumu (play, stop, position) için tek ve merkezi doğru kaynak (Single Source of Truth). State doğrudan buradan okunur, React bileşenleri `usePlaybackStore` üzerinden bu state'i dinler.
    - **Kullanım:** Yeni bir instance oluşturma, her zaman `PlaybackController.getInstance()` kullan.

2.  **`UIUpdateManager` (RAF Konsolidasyonu):**
    - **Dosya:** `lib/ui/UIUpdateManager.js`
    - **Prensip:** Tüm UI güncellemeleri (özellikle animasyonlar ve görselleştirmeler) bu merkezi `requestAnimationFrame` yöneticisi üzerinden yapılmalı. Asla bileşen içinde özel `requestAnimationFrame` döngüsü başlatma.
    - **Kullanım:** `uiUpdateManager.subscribe('my-component-id', updateCallback)` ile kayıt ol.

3.  **`EventBus` (Pub/Sub):**
    - **Dosya:** `lib/core/EventBus.js`
    - **Prensip:** Bileşenler ve modüller arası iletişim için kullanılır. Bu, sistemi gevşek bağlı (loosely coupled) tutar.
    - **Kullanım:** `EventBus.emit('event-name', data)` ile olay yayınla, `EventBus.on('event-name', callback)` ile dinle.

4.  **`Zustand` ile State Yönetimi:**
    - **Dosya:** `store/usePlaybackStore.js` (ve diğer store'lar)
    - **Prensip:** React bileşenlerinin `PlaybackController` gibi singleton'ların state'ine reaktif olarak bağlanmasını sağlar. Store'lar, singleton'lardaki state'i yansıtır ve eylemleri onlara delege eder.
    - **Kullanım:** `const isPlaying = usePlaybackStore(state => state.isPlaying);`

5.  **`BaseAudioPlugin` & `useAudioPlugin` Hook'u:**
    - **Dosya:** `lib/audio/BaseAudioPlugin.js`, `hooks/useAudioPlugin.js`
    - **Prensip:** Plugin'ler için ses analizi (analyser), metrik hesaplama ve state yönetimi gibi ortak işlevleri soyutlar. Bu, boilerplate kodu %90 oranında azaltır.
    - **Kullanım:** Plugin UI bileşenlerinde `const { metrics, getTimeDomainData } = useAudioPlugin(trackId, effectId);` hook'unu kullan.

---

## 🔌 4. Plugin Geliştirme Kutsal Kitabı

Yeni bir plugin oluştururken veya mevcut birini güncellerken izlenecek yol.

- **Mode-Based Tasarım Zorunludur:**
    - Kullanım senaryoları belirle (örn: "Vocal Warmth", "Bass Power").
    - Her senaryo için bir "mod" oluştur.
    - Ana kontrolü tek bir "Amount" veya "Drive" düğmesine bağla.
    - Detaylı ayarları `ExpandablePanel` içine gizle (Progressive Disclosure).

- **3-Panel Yerleşim Standardı:**
    - **Sol Panel (240px):** Başlık, Modlar, Bilgi.
    - **Orta Panel (flex-1):** Görselleştirme (üstte), Ana Kontroller.
    - **Sağ Panel (200px):** İstatistikler, Metrikler.

- **Bileşen Öncelikli Geliştirme (Component-First):**
    - Asla özel bir UI bileşeni yazma. Önce `Zenith Design System`'da var olanı kullan (`ProfessionalKnob`, `ZenithSlider` vb.).
    - Gerekirse, mevcut bileşeni props'ları aracılığıyla özelleştir.

- **Kategori Teması (Category Theming) Zorunludur:**
    - Her plugine ve içindeki her Zenith bileşenine bir `category` prop'u eklenmelidir.
    - Bu, görsel kimliği otomatik olarak ayarlar.
    - **Kategoriler:** `texture-lab` (Turuncu), `dynamics-forge` (Mavi), `spectral-weave` (Mor), `modulation-machines` (Yeşil), `spacetime-chamber` (Kırmızı).
    - **Örnek:** `<Knob category="texture-lab" />`

- **Hayalet Değerler (Ghost Values):**
    - `useGhostValue` hook'unu kullanarak interaktif kontrollere (Knob, Slider) "analog" bir his ve görsel geri bildirim ekle.
    - **Örnek:** `<Knob value={drive} ghostValue={useGhostValue(drive, 400)} />`

- **Geliştirme Akışı (15 dk):**
    1. `PluginTemplate.jsx` ve `template-processor.js` dosyalarını kopyala.
    2. İsimleri ve ID'leri güncelle.
    3. `pluginConfig.jsx` dosyasına yeni plugin'i kaydet.
    4. DSP mantığını processor dosyasında implemente et.
    5. UI'ı Zenith bileşenleri ile oluştur.

---

## 📏 5. En Önemli Geliştirme Kuralları (Golden Rules)

1.  **Sıfır Kırılma (Zero Breaking Changes):** Her yeni özellik geriye dönük %100 uyumlu olmalı.
2.  **Tekrar Etme (DRY):** Boilerplate kod yazma. `useAudioPlugin` gibi hook'ları ve `BaseAudioPlugin` gibi soyut sınıfları kullan.
3.  **Performans Önceliklidir:** Hedef her zaman 60fps. `UIUpdateManager` kullan. Ağır işlemleri `useCallback`, `useMemo` ile optimize et.
4.  **Tek Doğruluk Kaynağı (Single Source of Truth):** State her zaman tek bir merkezi yerden gelmeli (`PlaybackController` gibi). Bileşenlerin kendi state'lerini tutmasından kaçın.
5.  **Olay Güdümlü İletişim (Event-Driven):** Modüller arası doğrudan çağrı yapma. `EventBus` kullan.
6.  **Hardcoded Değerler Yok:** Tüm konfigürasyonlar (`pluginConfig.jsx` gibi) merkezi dosyalarda olmalı.
7.  **İsimlendirme ve Dosya Yapısı:** `DAWG_MASTER_PLAN.md` içindeki standartlara uy.
    - Bileşenler: `PascalCase.jsx`
    - Hook'lar: `camelCase.js`
    - Worklet'ler: `kebab-case.js`

---

## 🚀 6. Acil Öncelikler (Immediate Goals)

- **Kalan 8 Plugin'in Tamamlanması:**
    - **Tier 1 (Yüksek Öncelik):** `AdvancedEQ` ve diğer 2 plugin.
    - **Tier 2 (Orta Öncelik):** `TidalFilter`, `StardustChorus`, `VortexPhaser`.
    - **Tier 3 (Düşük Öncelik):** `ArcadeCrusher`, `PitchShifter`, `BassEnhancer808`.

- **Mimariyi Parlatma:**
    - `ArrangementCanvasRenderer`'ı `UIUpdateManager`'a taşı.
    - Bir debug logger sistemi implemente et.

---

## 📚 7. Önemli Dosyalar Dizini (File Index)

- **Ana Plan:** `docs/DAWG_MASTER_PLAN.md` (Bu projenin anayasası)
- **Plugin Felsefesi:** `docs/PLUGIN_DESIGN_PHILOSOPHY.md`
- **Tasarım Sistemi:** `docs/ZENITH_DESIGN_SYSTEM.md`
- **Plugin Konfigürasyonu:** `client/src/config/pluginConfig.jsx`
- **Playback State:** `lib/core/PlaybackController.js` & `store/usePlaybackStore.js`
- **UI Güncelleme Yöneticisi:** `lib/ui/UIUpdateManager.js`
- **Plugin Altyapısı:** `lib/audio/BaseAudioPlugin.js` & `hooks/useAudioPlugin.js`
- **Plugin UI Şablonu:** `components/plugins/effects/PluginTemplate.jsx`
---