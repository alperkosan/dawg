// piano-roll-worker.js - Heavy computation worker for Piano Roll
// This file should be placed in the public/ folder

// Web Worker'lar Tone.js'e doğrudan erişemediği için,
// gerekli zamanlama hesaplamaları için basit bir mock (taklit) oluşturuyoruz.
const Tone = {
    Time: (val) => {
        if (typeof val === 'string') {
            if (val.endsWith('n')) return { toSeconds: () => 1 / parseInt(val) };
        }
        return { toSeconds: () => val };
    }
};

// Worker'ın global kapsamında ihtiyaç duyacağı sabitler
const totalKeys = 8 * 12;

/**
 * Piano Roll için tüm ağır hesaplamaları yapan ana sınıf.
 * Bu sınıf, ana arayüzü (UI thread) yavaşlatmadan arka planda çalışır.
 */
class PianoRollCalculations {
    /**
     * Ekranda çizilecek tüm ızgara çizgilerini hesaplar.
     * @param {object} params - Genişlik, yükseklik, zoom seviyeleri gibi bilgiler.
     * @returns {object} Dikey ve yatay çizgilerin koordinatlarını ve stillerini içeren obje.
     */
    static calculateGrid(params) {
        const { width, height, stepWidth, keyHeight, zoomX, zoomY } = params;
        const gridLines = { vertical: [], horizontal: [] };

        // Dikey çizgiler (Zaman)
        const totalSteps = Math.ceil(width / stepWidth);
        for (let step = 0; step < totalSteps; step++) {
            const x = step * stepWidth;
            const positionInBar = step % 16; // 16'lık nota bazında
            
            let opacity = 0.1, strokeWidth = 0.5; // Varsayılan değerler
            
            // === GÖRSEL İYİLEŞTİRME BAŞLANGICI ===
            if (positionInBar === 0) { // Bar çizgisi (Kalın ve belirgin)
                opacity = 0.6; // Daha görünür
                strokeWidth = 2; // Daha kalın
            } else if (positionInBar % 4 === 0) { // Vuruş çizgisi (Orta belirginlikte)
                opacity = zoomX > 0.3 ? 0.4 : 0; // Opaklık artırıldı
                strokeWidth = 1.25; // Kalınlık artırıldı
            } else if (zoomX > 0.7) { // Alt bölüm çizgisi (İnce, sadece yakınlaşınca)
                opacity = Math.min(0.25, (zoomX - 0.7) * 0.4); // Opaklık artırıldı
            }
            // === GÖRSEL İYİLEŞTİRME SONU ===
            
            if (opacity > 0) {
                // === HATA DÜZELTMESİ: Çizginin yüksekliğini canvas'ın tam yüksekliği yapıyoruz ===
                gridLines.vertical.push({ x, opacity, strokeWidth, height: height });
            }
        }

        // Yatay çizgiler (Pitch)
        const totalKeyCount = Math.ceil(height / keyHeight);
        for (let key = 0; key < totalKeyCount; key++) {
            const y = key * keyHeight;
            const noteIndex = (totalKeyCount - 1 - key) % 12;
            const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
            
            // === GÖRSEL İYİLEŞTİRME: Yatay çizgiler de artık daha belirgin ===
            gridLines.horizontal.push({
                y,
                // Opaklık değerleri genel olarak artırıldı
                opacity: (isBlackKey ? 0.15 : 0.2) * (zoomY > 0.5 ? 1 : 0.5),
                strokeWidth: 0.75 // Kalınlık artırıldı
            });
        }
        return gridLines;
    }

    /**
     * Sadece ekranın görünür alanındaki notaların ID'lerini hesaplar.
     * @param {object} params - Notalar, viewport (görüş alanı) bilgileri.
     * @returns {Array<string>} Görünür notaların ID'lerini içeren dizi.
     */
    static calculateVisibleNotes(params) {
        const { notes, viewport, stepWidth, keyHeight } = params;
        const { left, top, width, height } = viewport;
        
        const margin = { x: stepWidth * 8, y: keyHeight * 4 };
        const viewBounds = {
            left: left - margin.x,
            right: left + width + margin.x,
            top: top - margin.y,
            bottom: top + height + margin.y
        };
        
        const visibleIDs = [];
        notes.forEach(note => {
            const noteY = (totalKeys - 1 - note.pitchIndex) * keyHeight; 
            const noteX = note.time * stepWidth;
            const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
            const noteWidth = durationInSteps * stepWidth;

            if (noteX < viewBounds.right && noteX + noteWidth > viewBounds.left &&
                noteY < viewBounds.bottom && noteY + keyHeight > viewBounds.top) {
                visibleIDs.push(note.id);
            }
        });
        return visibleIDs;
    }
}

// Worker'dan bir mesaj geldiğinde bu ana fonksiyon çalışır.
self.onmessage = function(e) {
    const { taskId, type, params } = e.data;
    
    try {
        let resultData;
        let resultType = type;
        
        switch (type) {
            case 'calculateGrid':
                resultData = PianoRollCalculations.calculateGrid(params);
                resultType = 'grid';
                break;
            case 'calculateVisible':
                resultData = PianoRollCalculations.calculateVisibleNotes(params);
                resultType = 'visibleNotes';
                break;
            default:
                throw new Error(`Bilinmeyen görev türü: ${type}`);
        }
        
        // Hesaplama sonucunu, tip bilgisiyle birlikte ana arayüze geri gönderir.
        self.postMessage({ taskId, result: { type: resultType, data: resultData } });
    } catch (error) {
        self.postMessage({ taskId, error: error.message });
    }
};

