// src/features/piano_roll_v5/renderer.js

// --- SABİTLER ---
const RULER_HEIGHT = 30; // Piksel
const KEYBOARD_WIDTH = 80; // Piksel
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Verilen bilgilere göre tüm Piano Roll arayüzünü çizen ana fonksiyon.
 * @param {CanvasRenderingContext2D} ctx - Çizim yapılacak 2D canvas context'i.
 * @param {object} engine - usePianoRollEngine hook'undan gelen tüm veriler.
 */
export function drawPianoRoll(ctx, engine) {
    const { viewport, dimensions, lod } = engine;

    // 1. Arka planı temizle
    ctx.fillStyle = '#1e293b'; // Daha koyu bir arkaplan
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // 2. Çizim alanını kaydır (Pan işlemi)
    ctx.save();
    ctx.translate(-viewport.scrollX, -viewport.scrollY);

    // 3. Ana Grid'i Çiz
    drawGrid(ctx, viewport, dimensions, lod);

    // 4. Notaları Çiz (Bu adım sonraki aşamada eklenecek)
    // drawNotes(ctx, viewport, dimensions, notes);

    // 5. Kaydırma transformasyonunu geri al
    ctx.restore();

    // 6. Statik Kısımları (Klavye ve Zaman Cetveli) Çiz
    // Bu kısımlar kaydırmadan etkilenmez.
    drawKeyboard(ctx, viewport, dimensions, lod);
    drawTimeline(ctx, viewport, dimensions, lod);

    // 7. Köşeyi ve kenarlık çizgilerini çiz
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, viewport.height);
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(viewport.width, RULER_HEIGHT);
    ctx.stroke();
}

// --- YARDIMCI ÇİZİM FONKSİYONLARI ---

function drawGrid(ctx, viewport, dimensions, lod) {
    // Siyah tuşların arka planını çiz
    ctx.fillStyle = '#1a202c';
    for (let i = 0; i < dimensions.totalKeys; i++) {
        const keyIndex = i % 12;
        if ([1, 3, 6, 8, 10].includes(keyIndex)) { // Siyah tuşlar
            const y = i * dimensions.keyHeight;
            ctx.fillRect(0, y, dimensions.totalWidth, dimensions.keyHeight);
        }
    }

    // Dikey çizgiler (Zaman)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1;
    const { startStep, endStep } = viewport.visibleSteps;

    for (let step = startStep; step <= endStep; step++) {
        const x = step * dimensions.stepWidth;
        
        if (lod > 1 && step % 4 !== 0) continue; // Uzak zoom'da 16'lıkları gizle
        if (lod > 2 && step % 16 !== 0) continue; // Daha da uzak zoom'da beat'leri gizle
        
        ctx.lineWidth = (step % 16 === 0) ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.totalHeight);
        ctx.stroke();
    }

    // Yatay çizgiler (Nota)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 0.5;
    const { startKey, endKey } = viewport.visibleKeys;

    for (let key = startKey; key <= endKey; key++) {
        const y = key * dimensions.keyHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.totalWidth, y);
        ctx.stroke();
    }
}

function drawKeyboard(ctx, viewport, dimensions, lod) {
    ctx.save();
    ctx.translate(0, -viewport.scrollY); // Sadece dikey kaydırma uygula

    // Klavye arkaplanı
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, dimensions.totalHeight);

    const { startKey, endKey } = viewport.visibleKeys;

    for (let key = startKey; key <= endKey; key++) {
        const y = key * dimensions.keyHeight;
        const keyIndex = key % 12;
        const noteName = NOTES[keyIndex];
        const octave = Math.floor(key / 12) -1;
        const isBlack = noteName.includes('#');
        
        // Tuş rengi
        ctx.fillStyle = isBlack ? '#1a202c' : '#cbd5e1';
        ctx.fillRect(0, y, KEYBOARD_WIDTH, dimensions.keyHeight);
        
        // Tuş adı (sadece C notaları ve yakın zoom için)
        if (lod < 2 && noteName === 'C') {
            ctx.fillStyle = isBlack ? '#e2e8f0' : '#1a202c';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${noteName}${octave}`, KEYBOARD_WIDTH - 8, y + dimensions.keyHeight / 2 + 4);
        }
    }

    // Tuşlar arası çizgiler
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    for (let key = startKey; key <= endKey; key++) {
        const y = key * dimensions.keyHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(KEYBOARD_WIDTH, y);
        ctx.stroke();
    }

    ctx.restore();
}

function drawTimeline(ctx, viewport, dimensions, lod) {
    ctx.save();

    // --- YENİ EKLENEN KOD BAŞLANGICI ---
    // 1. Çizim alanını klavye genişliği kadar sağa kaydırıyoruz.
    //    Artık tüm çizimler (x=0), klavyenin bittiği yerden başlayacak.
    ctx.translate(KEYBOARD_WIDTH, 0);

    // 2. Bu alanın dışına çizim yapılmasını engelle ( Clipping ).
    //    Bu, klavyenin üzerine yanlışlıkla çizim yapılmasını önler.
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width - KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.clip();
    // --- YENİ EKLENEN KOD SONU ---

    ctx.translate(-viewport.scrollX, 0); // Sadece yatay kaydırma uygula

    // Zaman cetveli arkaplanı
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, dimensions.totalWidth, RULER_HEIGHT);

    // Zaman çizgileri ve rakamları
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';

    const { startStep, endStep } = viewport.visibleSteps;

    for (let step = startStep; step <= endStep; step++) {
         if (step % 16 === 0) { // Bar çizgisi
            const x = step * dimensions.stepWidth;
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Çizgiyi RULER_HEIGHT'ın en altından başlatıp yukarı doğru çiz
            ctx.moveTo(x, RULER_HEIGHT - 10);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
            if (lod < 3) {
                 // Yazıyı çizginin hemen sağına ve biraz yukarısına yaz
                 ctx.fillText(step / 16 + 1, x + 4, RULER_HEIGHT - 10);
            }
        } else if (lod < 2 && step % 4 === 0) { // Beat çizgisi
            const x = step * dimensions.stepWidth;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            // Beat çizgisini daha kısa yap
            ctx.moveTo(x, RULER_HEIGHT - 5);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
        }
    }
    
    ctx.restore();
}