Elbette! Projenizin kalitesini ve mimarisini yansıtan, hem geliştiricilerin hem de yapay zeka modellerinin anlayabileceği kadar net ve detaylı bir README.md dosyası hazırladım. Bu dosya, projenizin temel felsefesini, çalışma mantığını ve teknik yapısını kapsamlı bir şekilde açıklamaktadır.

Proje DAWG: Modern Web Tabanlı Dijital Ses İşleme İstasyonu
DAWG (Digital Audio Workstation by Gemini), tamamen modern web teknolojileri kullanılarak sıfırdan inşa edilmiş, yüksek performanslı bir dijital ses işleme istasyonudur. React, Zustand ve Web Audio API'nin en güçlü özelliklerini bir araya getirerek, tarayıcıda profesyonel kalitede müzik prodüksiyonu deneyimi sunmayı hedefler.

✨ Teknik Felsefe ve Mimari Yaklaşım
Bu proje, üç temel prensip üzerine kurulmuştur:

Ses Motoru ve Arayüzün Ayrıştırılması (Decoupling): Ses üreten ve işleyen NativeAudioEngine, kullanıcı arayüzünden (React bileşenleri) tamamen soyutlanmıştır. İletişim, yalnızca iyi tanımlanmış servisler (AudioContextService) ve store'lar üzerinden kurulur. Bu, ses motorunda bir takılmanın arayüzü, arayüzdeki bir render sorununun ise sesi asla etkilememesini sağlar.

State'in Tek Doğruluk Kaynağı Olması (Single Source of Truth): Uygulamanın tüm durumu (çalma pozisyonu, mikser seviyeleri, pattern verileri vb.) Zustand store'ları içinde yönetilir. Bileşenler bu store'lara abone olur ve motor bu store'lardan beslenir. Bu, öngörülebilir ve kolayca hata ayıklanabilir bir veri akışı yaratır.

Olay Tabanlı ve Reaktif İletişim: Sistem, kullanıcı eylemlerine ve motor güncellemelerine reaktif olarak yanıt verir. Bir komut (Command) veya olay, sistemin ilgili parçalarını zincirleme bir reaksiyonla günceller.

🤖 AI Modeli İçin Çalışma Diagramı ve Veri Akışı
Bu bölüm, projenin içsel çalışma mantığını bir yapay zeka modelinin anlayabileceği şekilde şemalaştırır. Sistemde iki ana veri akış yönü vardır:

1. Akış: Kullanıcı Etkileşiminden Ses Motoruna (UI → Engine)
Bu akış, kullanıcının bir butona tıklaması gibi bir eylemle başlar ve ses motorunda bir değişikliğe neden olur.

Örnek: "Play" Butonuna Basılması

1. [Kullanıcı Arayüzü]
   TopToolbar.jsx'teki <button> tıklandı.
     |
     v
2. [Zustand Store Eylemi]
   usePlaybackStore.getState().togglePlayPause() çağrıldı.
     |
     v
3. [Merkezi Servis Katmanı]
   togglePlayPause() fonksiyonu, AudioContextService.getAudioEngine() üzerinden
   ses motoru örneğine erişir ve .play() metodunu çağırır.
     |
     v
4. [Çekirdek Ses Motoru]
   NativeAudioEngine.play() metodu tetiklenir.
     |
     v
5. [Alt Sistemler]
   a) PlaybackManager.play() mevcut duruma göre oynatmayı başlatır.
   b) NativeTransportSystem.start() zamanlayıcıyı (worker timer) başlatır.
   c) PlaybackManager, aktif pattern'deki notaları zamanlama için transport'a gönderir.
2. Akış: Ses Motorundan Kullanıcı Arayüzüne (Engine → UI)
Bu akış, ses motorunun kendi iç durumundaki bir değişikliği (zamanın ilerlemesi gibi) arayüze yansıtmasıdır.

Örnek: Playhead Pozisyonunun Güncellenmesi

1. [Çekirdek Zamanlayıcı]
   NativeTransportSystem içindeki Worker Timer, periyodik olarak 'tick' olayı yayınlar.
     |
     v
2. [Çekirdek Ses Motoru]
   NativeAudioEngine, bu 'tick' olayını dinler ve constructor'da aldığı
   this.setTransportPosition() callback fonksiyonunu o anki adım (step)
   bilgisiyle çağırır.
     |
     v
3. [Başlatma & Bağlantı Noktası]
   Bu callback, App.jsx'te motor başlatılırken usePlaybackStore.getState().setTransportPosition
   olarak tanımlanmıştır.
     |
     v
4. [Zustand Store Güncellemesi]
   usePlaybackStore içindeki 'transportStep' ve 'transportPosition' state'leri
   yeni değerlerle güncellenir.
     |
     v
5. [Kullanıcı Arayüzü]
   a) ChannelRack.jsx, usePlaybackStore'a abone olduğu için güncellemeyi alır.
   b) useEffect, 'transportStep' bağımlılığındaki değişikliği fark eder.
   c) playheadRef.current.style.transform'i yeni pozisyona göre güncelleyerek
      playhead'i ekranda hareket ettirir.
🚀 Teknolojiler
Çerçeve (Framework): React 18+

Ses Motoru: Native Web Audio API & AudioWorklets

Durum Yönetimi (State Management): Zustand

Stil (Styling): Tailwind CSS & CSS Değişkenleri (Temalama için)

Sürükle & Bırak (Drag & Drop): React DnD

Dil (Language): JavaScript (ES6+)

Paketleyici (Bundler): Vite

📂 Proje Yapısı
Proje, sorumlulukların net bir şekilde ayrıldığı modüler bir klasör yapısına sahiptir:

/src
|
|-- components/       # Genel, yeniden kullanılabilir React bileşenleri (örn: DebugPanel)
|-- config/           # Proje genelindeki konfigürasyonlar (paneller, plugin'ler, sabitler)
|-- features/         # Ana özellik modülleri (channel_rack, mixer_v2, piano_roll_v2 vb.)
|-- hooks/            # Yeniden kullanılabilir React hook'ları
|-- layout/           # Ana uygulama yerleşimini yöneten bileşenler (WorkspacePanel)
|-- lib/              # Uygulamanın çekirdek mantığı
|   |-- audio/        # AudioWorklet'ler ve sesle ilgili yardımcı sınıflar
|   |-- commands/     # Geri Al/Yinele (Undo/Redo) için komut deseni implementasyonu
|   |-- core/         # NativeAudioEngine ve alt sistemleri (Transport, PlaybackManager)
|   |-- interfaces/   # Motorun farklı yetenekleri için üst düzey API'ler
|   |-- services/     # Uygulama genelinde erişilen singleton servisler (AudioContextService)
|   `-- utils/        # Genel yardımcı fonksiyonlar (zamanlama, matematik vb.)
|-- store/            # Tüm Zustand store tanımları
|-- styles/           # Global CSS ve stil parçaları
`-- ui/               # Daha karmaşık, paylaşılan UI bileşenleri (Plugin'ler, pencereler)
🛠️ Kurulum ve Başlatma
Bağımlılıkları Yükleyin:

Bash

npm install
Geliştirme Sunucusunu Başlatın:

Bash

npm run dev
Uygulamayı tarayıcınızda http://localhost:5173 (veya terminalde belirtilen port) adresinde açın.

🌟 Temel Özellikler
Düşük Gecikmeli Ses Motoru: Tüm ses işlemleri, ana thread'i tıkamayan AudioWorklet'ler üzerinde çalışır.

Pattern ve Song Modu: Hem döngüsel pattern tabanlı çalmayı hem de zaman çizelgesi üzerinde doğrusal şarkı düzenlemesini destekler.

Modüler Plugin Sistemi: Yeni ses efektleri (plugin'ler) kolayca sisteme eklenebilir ve yönetilebilir.

Geri Al/Yinele Desteği: Command deseni kullanılarak yapılan işlemler (nota ekleme/silme) geri alınabilir.

Dinamik Pencere Yönetimi: Sürüklenip yeniden boyutlandırılabilen panel sistemi.

Temalama Desteği: CSS Değişkenleri sayesinde uygulamanın görünümü anlık olarak değiştirilebilir.

🗺️ Gelecek Planları (Roadmap)
MIDI Kayıt: Klavyeden canlı MIDI girişi ve kaydı.

Otomasyon Klipleri: Mikser ve efekt parametreleri için zaman çizelgesinde otomasyon çizimi.

WebAssembly (WASM): C++ ile yazılmış yüksek performanslı DSP (Sinyal İşleme) kütüphanelerinin entegrasyonu.

Proje Kaydetme/Yükleme: Proje durumunu dosyaya veya buluta kaydetme.


----------------------------------------------
Diyagramın Yorumlanması
Bu diyagram, modern ve temiz bir ses uygulaması mimarisini gösteriyor. Katmanlar arasındaki sorumluluk ayrımı çok net:

UI Katmanı (En Dış Halka): Kullanıcının gördüğü ve etkileşimde bulunduğu her şey burada. "Piano Roll", "Mixer Arayüzü" gibi bileşenler bulunur. Bu katmanın tek görevi, kullanıcı eylemlerini "Servis Katmanı"na bildirmek ve servislerden gelen verilerle kendini güncellemektir.

Servis Katmanı (Orta Halka): Uygulamanın beyni. "Playback Servisi", "Enstrüman Servisi" gibi birimler, UI'dan gelen "çal" gibi basit istekleri, motorun anlayacağı teknik komutlara çevirir. Aynı zamanda motordan gelen teknik verileri (örneğin "tick ilerledi") UI'ın anlayacağı durumlara ("playhead pozisyonu değişti") dönüştürür.

Çekirdek Ses Motoru (İç Halka): Uygulamanın kalbi. "Transport" (zaman yönetimi), "Scheduler" (nota planlama) ve "Audio Graph" (ses yönlendirme) gibi en temel birimleri içerir. Bu katman, UI veya uygulamanın genel durumu hakkında hiçbir şey bilmez. Sadece servislerden gelen "şunu şu zamanda çal" gibi net komutları yerine getirir.

Audio Worklets (Ayrı Dünya): Sesin fiilen işlendiği, ana tarayıcı thread'inden bağımsız, yüksek öncelikli alandır. Çekirdek motor, postMessage ile bu dünyaya komutlar gönderir ("şu frekansta bir osilatör başlat").

Bu mimari, "gevşek bağlılık" (loose coupling) ve "tek sorumluluk" (single responsibility) ilkelerine dayanır. Her katman sadece komşusuyla konuşur ve kendi işine odaklanır.

Son Hatalarımız ve Diyagramla İlişkisi
Şimdi bu haritayı kullanarak son yaşadığımız hataların kök nedenini nasıl bulabildiğimize bakalım:

toFixed is not a function Hatası:

Diyagramdaki Kural: UI -> Servis -> Çekirdek şeklinde net bir iletişim olmalı.

Hatanın Nedeni: PlaybackManager (Servis/Yönetici Katmanı), _scheduleInstrumentNotes fonksiyonuna startTime parametresini iletmeyi unuttuğunda, Çekirdek'e eksik bilgi gitmiş oldu. Diyagramdaki "Servis -> Çekirdek" oku üzerindeki veri akışı bozuldu. Hata tam olarak bu iletişim kanalındaki bir aksaklıktan kaynaklandı.

Döngünün (Loop) Tekrar Çalmaması Sorunu:

Diyagramdaki Kural: Diyagramda Çekirdek'ten Servis'e geri dönen oklar var. Bu, "Geri Bildirim Döngüsü" (Feedback Loop) anlamına gelir. Yani çekirdek, durumu hakkında üst katmanlara bilgi vermelidir.

Hatanın Nedeni: NativeTransportSystem (Çekirdek), bir döngüyü tamamladığında bu bilgiyi PlaybackManager'a (Servis) geri bildirmiyordu. Çekirdek kendi içinde döngüyü başa sarıyor ama Servis'in bundan haberi olmuyordu.

Çözümümüz: Tam olarak diyagramın önerdiği şeyi yaptık. NativeTransportSystem'e bir 'loop' olayı ekleyerek Çekirdek'ten Servis'e bir geri bildirim kanalı oluşturduk. PlaybackManager bu olayı dinleyerek notaları yeniden planladı ve sorun çözüldü.

Bu Diyagramı Kullanarak Gelecekteki Hataları Nasıl Önleriz?
Bu harita, kod yazarken kendimize sormamız gereken sorular için bir kontrol listesi sunuyor:

"Bu kod doğru katmanda mı?"

Örnek: Bir React component'inin içinde doğrudan nativeAudioEngine.transport.start() çağırmaya çalışıyorsak, bu diyagrama aykırıdır. Bu istek mutlaka playbackService.play() üzerinden yapılmalıdır. Bu kural, kodun test edilebilir ve yönetilebilir kalmasını sağlar.

"İletişim tek yönlü mü olmalı, çift yönlü mü?"

Örnek: UI, Servis'e bir komut gönderir. Bu tek yönlüdür. Ancak Çekirdek'in durumu değiştiğinde (örneğin CPU yükü arttığında veya çalma durumu değiştiğinde), bunu Servis'e bildirmesi gerekir. Bu da çift yönlü bir iletişim gerektirir. "Loop" sorunumuz, bu geri bildirim okunu unutmaktan kaynaklanmıştı.

"Katmanlar arasındaki 'dil' (API) net mi?"

Örnek: PlaybackManager'ın transport.stepsToSeconds() fonksiyonuna ihtiyaç duyması ama NativeTransportSystem'de bu fonksiyonun olmaması, katmanlar arasındaki dilin tutarsız olduğunu gösteriyordu. Katmanların birbirine sunduğu fonksiyonlar ve olaylar (API) en başından net bir şekilde tanımlanmalıdır.




evet, çalışmaya başladığında içerisine boşalttığımız çöpü başarılı bir şekilde öğütebilen ve fişini çekene kadar durmayan bir motorumuz oldu. şimdi arayüzümüzü motora bağlayıp onun gücünü gerektiği yerde gerektiği kadar, konuşarak anlaşarak, kullanıcıyı da ne yaptığını (onun tickine karşılık bizim bbt formatında gösterimimiz, kullanıcıya zoom yaptıkça ticklere yaklaşmasını sağlayacağımız arayüzümüz)  gösterecek hale getireceğiz. öncelikle iç motor fonksiyonlarının tetiklenmelerinin düzeltilmesi daha sonra dışardan gönderilen parametrelere doğru şekilde bağlanmasını sağlayacağız. bu yolda bize bir iyileştirme planı hazırla çekirdekten arayüze doğru katman katman kabloları bağlayarak ilerleyelim.