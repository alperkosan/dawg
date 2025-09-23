# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.





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