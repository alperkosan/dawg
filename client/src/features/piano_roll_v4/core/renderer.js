/**
 * @file renderer.js
 * @description Canvas üzerine grid, notalar ve diğer elementleri çizer.
 */

import { RENDER_CONFIG, MUSIC_CONFIG, LOD_CONFIG } from '../config';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Her render döngüsünde sahneyi temizler.
   * DÜZELTME: Artık arka planı beyaz tuş rengiyle boyuyoruz.
   */
  clear() {
    this.ctx.fillStyle = RENDER_CONFIG.WHITE_KEY_COLOR; // Ana zemin beyaz tuş rengi oldu
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  /**
   * Dinamik ve zoom seviyesine duyarlı grid'i çizer.
   * @param {import('./viewport').Viewport} viewport
   */
  drawGrid(viewport) {
    const { start: startTick, end: endTick } = viewport.getVisibleTickRange();
    const { start: startMidi, end: endMidi } = viewport.getVisibleMidiRange();

    // Excel tarzı - sadece grid çizgileri, piano key background yok
    this.drawVerticalLines(viewport, startTick, endTick);
    this.drawHorizontalLines(viewport, startMidi, endMidi);
  }

  /**
   * Piyano tuşlarının (sadece siyah olanların) arka planını çizer.
   */
  drawKeybedBackground(viewport, startMidi, endMidi) {
      if (isNaN(startMidi) || isNaN(endMidi)) return;

      const firstMidiLine = Math.floor(startMidi);
      for (let midi = firstMidiLine; midi < endMidi + 1; midi++) {
          const noteIndex = ((midi % 12) + 12) % 12;
          const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][noteIndex];
          const isBlackKey = noteName && noteName.includes('#');

          if (isBlackKey) {
              const { y } = viewport.worldToScreen(0, midi);
              this.ctx.fillStyle = RENDER_CONFIG.BLACK_KEY_COLOR;
              // DÜZELTME: y pozisyonunu tuşun alt kenarından değil, üst kenarından başlat
              this.ctx.fillRect(0, y, this.canvas.width, viewport.zoomY);
          }
      }
  }

  drawVerticalLines(viewport, startTick, endTick) {
    const { TICKS_PER_QUARTER_NOTE } = MUSIC_CONFIG;
    const { ZOOM_THRESHOLDS } = LOD_CONFIG;

    // Ölçü çizgileri (her zaman görünür)
    let step = TICKS_PER_QUARTER_NOTE * 4; // 4/4'lük ölçü
    this.drawTimeLines(viewport, startTick, endTick, step, RENDER_CONFIG.GRID_PRIMARY_COLOR, 1.5);

    // Dörtlük nota çizgileri (Normal ve Detaylı zoom'da görünür)
    if (viewport.zoomX >= ZOOM_THRESHOLDS.NORMAL) {
      step = TICKS_PER_QUARTER_NOTE;
      this.drawTimeLines(viewport, startTick, endTick, step, RENDER_CONFIG.GRID_SECONDARY_COLOR, 1);
    }

    // Onaltılık nota çizgileri (Sadece Detaylı zoom'da görünür)
    if (viewport.zoomX >= ZOOM_THRESHOLDS.DETAILED) {
      step = TICKS_PER_QUARTER_NOTE / 4;
      this.drawTimeLines(viewport, startTick, endTick, step, RENDER_CONFIG.GRID_TERTIARY_COLOR, 0.5);
    }
  }

  drawHorizontalLines(viewport, startMidi, endMidi) {
      if (isNaN(startMidi) || isNaN(endMidi)) return;

      const firstMidiLine = Math.floor(startMidi);

      for (let midi = firstMidiLine; midi < endMidi + 1; midi++) {
          // Excel tarzı infinite scroll - sınır kontrolü yok

          // Excel tarzı uniform grid - tüm çizgiler aynı
          this.ctx.strokeStyle = RENDER_CONFIG.GRID_PRIMARY_COLOR;
          this.ctx.lineWidth = RENDER_CONFIG.GRID_LINE_WIDTH_PRIMARY;

          const { y } = viewport.worldToScreen(0, midi);

          // Her çizgiyi ayrı çiz (performans için)
          this.ctx.beginPath();
          this.ctx.moveTo(0, y + viewport.zoomY);
          this.ctx.lineTo(this.canvas.width, y + viewport.zoomY);
          this.ctx.stroke();
      }
  }

  /**
   * Yardımcı fonksiyon: Belirli aralıklarla dikey çizgileri çizer.
   */
  drawTimeLines(viewport, startTick, endTick, step, color, lineWidth) {
    const firstLine = Math.floor(startTick / step) * step;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    for (let tick = firstLine; tick < endTick; tick += step) {
      const { x } = viewport.worldToScreen(tick, 0);
      if (x > 0 && x < this.canvas.width) { // Sadece ekranda görünenleri çiz
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, this.canvas.height);
      }
    }
    this.ctx.stroke();
  }

  /**
   * Verilen nota listesini çizer.
   * @param {import('./viewport').Viewport} viewport
   * @param {Array<{tick: number, midiNote: number, duration: number}>} notes
   */
  drawNotes(viewport, notes) {
    for (const note of notes) {
      this.drawNote(viewport, note);
    }
  }

  /**
   * Tek bir notayı çizer. (Fonksiyonun kendisi aynı, sadece çağrılma şekli değişti)
   */
  drawNote(viewport, note) {
    const { x, y } = viewport.worldToScreen(note.tick, note.midiNote);
    const noteWidth = note.duration * viewport.zoomX;
    const noteHeight = viewport.zoomY;

    // Grid boyutlarına göre padding hesapla (zoom seviyesine göre dinamik)
    const horizontalPadding = Math.max(1, viewport.zoomX * 0.05); // %5 horizontal padding
    const verticalPadding = Math.max(1, viewport.zoomY * 0.1);     // %10 vertical padding

    // Notanın en az 1 piksel görünmesini sağla (padding'den sonra)
    const displayWidth = Math.max(1, noteWidth - horizontalPadding * 2);
    const displayHeight = Math.max(1, noteHeight - verticalPadding * 2);

    this.ctx.fillStyle = note.isSelected ? RENDER_CONFIG.NOTE_SELECTED_COLOR : RENDER_CONFIG.NOTE_COLOR;
    this.ctx.fillRect(x + horizontalPadding, y + verticalPadding, displayWidth, displayHeight);
  }

}