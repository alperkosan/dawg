// Koordinat Sistemi Test Dosyası
// Bu dosyayı tarayıcı console'unda çalıştırın

function testCoordinateSystem() {
  console.log('=== PIANO ROLL KOORDINAT SİSTEMİ TESTİ ===');

  // Test verileri
  const testCases = [
    { time: 0, pitch: 'C4', expectedX: 0, expectedY: 'middle' },
    { time: 4, pitch: 'C4', expectedX: '4 beat', expectedY: 'middle' },
    { time: 1, pitch: 'C5', expectedX: '1 beat', expectedY: 'upper' },
    { time: 2, pitch: 'C3', expectedX: '2 beat', expectedY: 'lower' },
  ];

  // Engine'ı bul
  const pianoRollContainer = document.querySelector('.prv2-grid-area-container');
  if (!pianoRollContainer) {
    console.error('❌ Piano Roll container bulunamadı');
    return;
  }

  // Boyutları ölç
  const rect = pianoRollContainer.getBoundingClientRect();
  console.log('📐 Container boyutları:', {
    width: rect.width,
    height: rect.height,
    scrollLeft: pianoRollContainer.scrollLeft,
    scrollTop: pianoRollContainer.scrollTop
  });

  // Grid dimensyonları
  const gridElement = document.querySelector('[style*="position: relative"][style*="transform: translate3d"]');
  if (gridElement) {
    const gridStyle = gridElement.style;
    console.log('🎹 Grid boyutları:', {
      width: gridStyle.width,
      height: gridStyle.height,
      transform: gridStyle.transform
    });
  }

  // SVG grid'i kontrol et
  const svgGrid = document.querySelector('.precision-grid');
  if (svgGrid) {
    console.log('📊 SVG Grid:', {
      width: svgGrid.getAttribute('width'),
      height: svgGrid.getAttribute('height'),
      viewBox: svgGrid.getAttribute('viewBox')
    });
  }

  // Mouse pozisyon testi için listener ekle
  let isTestingMouse = false;

  function startMouseTest() {
    if (isTestingMouse) return;
    isTestingMouse = true;

    console.log('🖱️  Mouse test başlatıldı. Piano Roll\'de fareyi hareket ettirin...');

    const mouseHandler = (e) => {
      const containerRect = pianoRollContainer.getBoundingClientRect();
      const scrollX = pianoRollContainer.scrollLeft;
      const scrollY = pianoRollContainer.scrollTop;

      const gridX = e.clientX - containerRect.left + scrollX;
      const gridY = e.clientY - containerRect.top + scrollY;

      // Tahmini zaman ve pitch hesaplama
      const estimatedTime = gridX / 40; // 40px per step tahmini
      const estimatedPitch = Math.floor((1920 - gridY) / 20); // 20px per key tahmini

      console.log('📍 Mouse pozisyon:', {
        clientX: e.clientX,
        clientY: e.clientY,
        gridX: Math.round(gridX),
        gridY: Math.round(gridY),
        estimatedTime: estimatedTime.toFixed(2),
        estimatedPitch: estimatedPitch,
        scrollX,
        scrollY
      });
    };

    pianoRollContainer.addEventListener('mousemove', mouseHandler);

    // 10 saniye sonra durdur
    setTimeout(() => {
      pianoRollContainer.removeEventListener('mousemove', mouseHandler);
      isTestingMouse = false;
      console.log('🛑 Mouse test durduruldu');
    }, 10000);
  }

  // Notaları kontrol et
  const notes = document.querySelectorAll('.prv2-note');
  console.log('🎵 Mevcut notalar:', notes.length);

  notes.forEach((note, index) => {
    if (index < 5) { // İlk 5 notayı kontrol et
      const style = note.style;
      const rect = note.getBoundingClientRect();
      console.log(`Note ${index + 1}:`, {
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        clientRect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });
    }
  });

  // Klavye tuşlarını kontrol et
  const keys = document.querySelectorAll('.prv2-keyboard__key');
  console.log('🎹 Klavye tuşları:', keys.length);

  if (keys.length > 0) {
    const firstKey = keys[0];
    const lastKey = keys[keys.length - 1];
    const firstRect = firstKey.getBoundingClientRect();
    const lastRect = lastKey.getBoundingClientRect();

    console.log('🎹 Klavye aralığı:', {
      firstKey: {
        y: Math.round(firstRect.y),
        height: Math.round(firstRect.height),
        text: firstKey.textContent?.trim()
      },
      lastKey: {
        y: Math.round(lastRect.y),
        height: Math.round(lastRect.height),
        text: lastKey.textContent?.trim()
      },
      totalHeight: Math.round(lastRect.bottom - firstRect.top)
    });
  }

  console.log('✅ Test tamamlandı. Mouse testi başlatmak için: startMouseTest()');
  window.startMouseTest = startMouseTest;
}

// Test fonksiyonunu global yap
window.testCoordinateSystem = testCoordinateSystem;
console.log('🚀 Koordinat testi hazır. Çalıştırmak için: testCoordinateSystem()');