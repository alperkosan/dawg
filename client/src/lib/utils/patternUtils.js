// client/src/lib/utils/patternUtils.js - FIXED VERSION WITH NATIVE SUPPORT
// DAWG - Pattern Utilities - Native AudioWorklet Engine Compatible

import { NativeTimeUtils } from './NativeTimeUtils.js';

/**
 * Bir pattern'ın loop uzunluğunu hesaplar (step cinsinden)
 * @param {Object} pattern - Pattern objesi
 * @param {number} defaultBPM - Varsayılan BPM
 * @returns {number} - Loop uzunluğu (step cinsinden)
 */
export const calculatePatternLoopLength = (pattern, defaultBPM = 120) => {
  if (!pattern || !pattern.data) {
    return 64; // Varsayılan uzunluk
  }

  let maxStep = 0;
  let noteCount = 0;

  // Tüm enstrümanların notalarını kontrol et
  const getNoteStart = (note) => {
    if (typeof note?.startTime === 'number' && !Number.isNaN(note.startTime)) {
      return note.startTime;
    }
    if (typeof note?.time === 'number' && !Number.isNaN(note.time)) {
      return note.time;
    }
    return 0;
  };

  const getNoteLength = (note) => {
    if (typeof note?.length === 'number' && note.length > 0) {
      return note.length;
    }
    if (note?.duration) {
      try {
        const durationInSeconds = NativeTimeUtils.parseTime(note.duration, defaultBPM);
        const sixteenthNoteSeconds = NativeTimeUtils.parseTime('16n', defaultBPM);
        return durationInSeconds / sixteenthNoteSeconds;
      } catch (error) {
        return 1;
      }
    }
    return 1;
  };

  Object.values(pattern.data).forEach(notes => {
    if (Array.isArray(notes)) {
      noteCount += notes.length;
      
      notes.forEach(note => {
        const startStep = getNoteStart(note);
        const lengthInSteps = getNoteLength(note);
        const noteEndStep = startStep + lengthInSteps;
      
        maxStep = Math.max(maxStep, noteEndStep);
      });
    }
  });

  // Eğer hiç nota yoksa, varsayılan uzunluk döndür
  if (noteCount === 0) {
    return 64;
  }

  // En yakın 16'nın katına yuvarla (1 bar = 16 step)
  const roundedLength = Math.ceil(maxStep / 16) * 16;
  
  // En az 16 step, en fazla 256 step
  return Math.max(16, Math.min(256, roundedLength));
};

/**
 * Arrangement'taki kliplere göre song uzunluğunu hesaplar
 * @param {Array} clips - Klip dizisi
 * @returns {number} - Song uzunluğu (step cinsinden)
 */
export const calculateArrangementLoopLength = (clips) => {
  if (!Array.isArray(clips) || clips.length === 0) {
    return 256; // Varsayılan song uzunluğu
  }

  let maxEndTime = 0;

  clips.forEach(clip => {
    const startTime = clip.startTime || 0; // Bar cinsinden
    const duration = clip.duration || 4;   // Bar cinsinden
    const endTime = startTime + duration;
    
    maxEndTime = Math.max(maxEndTime, endTime);
  });

  // Bar'ı step'e çevir (1 bar = 16 step)
  const totalSteps = maxEndTime * 16;
  
  // En yakın 16'nın katına yuvarla
  const roundedSteps = Math.ceil(totalSteps / 16) * 16;
  
  // En az 64 step, en fazla 1024 step
  return Math.max(64, Math.min(1024, roundedSteps));
};

/**
 * Audio loop uzunluğunu mode'a göre hesaplar
 * @param {string} mode - 'pattern' veya 'song'
 * @param {Object} data - Pattern veya arrangement verisi
 * @param {number} defaultBPM - Varsayılan BPM
 * @returns {number} - Loop uzunluğu (step cinsinden)
 */
export const calculateAudioLoopLength = (mode, data = {}, defaultBPM = 120) => {
  switch (mode) {
    case 'pattern':
      if (data.pattern) {
        return calculatePatternLoopLength(data.pattern, defaultBPM);
      }
      return 64;
      
    case 'song':
      if (data.clips) {
        return calculateArrangementLoopLength(data.clips);
      }
      return 256;
      
    default:
      console.warn(`Unknown mode: ${mode}, using default length`);
      return 64;
  }
};

/**
 * UI için channel rack uzunluğunu hesaplar
 * @param {Object} instrumentsData - Enstrüman verisi
 * @param {Object} activePattern - Aktif pattern
 * @returns {number} - UI uzunluğu (step cinsinden)
 */
export const calculateUIRackLength = (instrumentsData, activePattern) => {
  if (!activePattern) {
    return 64;
  }
  
  const patternLength = calculatePatternLoopLength(activePattern);
  
  // UI için biraz ekstra alan ekle
  return Math.max(64, patternLength + 16);
};

/**
 * Pattern'ın yoğunluğunu analiz eder
 * @param {Object} pattern - Pattern objesi
 * @returns {Object} - Analiz sonucu
 */
export const analyzePatternDensity = (pattern) => {
  if (!pattern || !pattern.data) {
    return {
      totalNotes: 0,
      averageNotesPerBar: 0,
      density: 'empty',
      hasNotes: false
    };
  }

  let totalNotes = 0;
  let instrumentCount = 0;
  
  Object.values(pattern.data).forEach(notes => {
    if (Array.isArray(notes) && notes.length > 0) {
      totalNotes += notes.length;
      instrumentCount++;
    }
  });

  const patternLength = calculatePatternLoopLength(pattern);
  const barsInPattern = patternLength / 16;
  const averageNotesPerBar = totalNotes / Math.max(1, barsInPattern);

  let density;
  if (totalNotes === 0) {
    density = 'empty';
  } else if (averageNotesPerBar < 2) {
    density = 'sparse';
  } else if (averageNotesPerBar < 8) {
    density = 'medium';
  } else if (averageNotesPerBar < 16) {
    density = 'dense';
  } else {
    density = 'very-dense';
  }

  return {
    totalNotes,
    averageNotesPerBar: parseFloat(averageNotesPerBar.toFixed(2)),
    density,
    hasNotes: totalNotes > 0,
    instrumentCount,
    patternLength
  };
};

/**
 * Pattern'ı optimize eder (boş alanları temizler)
 * @param {Object} pattern - Pattern objesi
 * @returns {Object} - Optimize edilmiş pattern
 */
export const optimizePattern = (pattern) => {
  if (!pattern || !pattern.data) {
    return pattern;
  }

  const optimizedData = {};
  
  Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
    if (Array.isArray(notes) && notes.length > 0) {
      // Geçerli notaları filtrele
      const validNotes = notes.filter(note => 
        note && 
        typeof note.time === 'number' && 
        note.time >= 0 &&
        note.pitch
      );
      
      if (validNotes.length > 0) {
        // Zamanına göre sırala
        validNotes.sort((a, b) => (a.time || 0) - (b.time || 0));
        optimizedData[instrumentId] = validNotes;
      }
    }
  });

  return {
    ...pattern,
    data: optimizedData
  };
};

/**
 * İki pattern'ı karşılaştırır
 * @param {Object} pattern1 - İlk pattern
 * @param {Object} pattern2 - İkinci pattern
 * @returns {Object} - Karşılaştırma sonucu
 */
export const comparePatterns = (pattern1, pattern2) => {
  const analysis1 = analyzePatternDensity(pattern1);
  const analysis2 = analyzePatternDensity(pattern2);

  return {
    pattern1: analysis1,
    pattern2: analysis2,
    similarity: calculatePatternSimilarity(pattern1, pattern2),
    lengthDifference: Math.abs(analysis1.patternLength - analysis2.patternLength),
    noteDifference: Math.abs(analysis1.totalNotes - analysis2.totalNotes)
  };
};

/**
 * Pattern benzerliğini hesaplar (0-1 arası)
 * @param {Object} pattern1 - İlk pattern
 * @param {Object} pattern2 - İkinci pattern
 * @returns {number} - Benzerlik skoru (0-1 arası)
 */
const calculatePatternSimilarity = (pattern1, pattern2) => {
  if (!pattern1?.data || !pattern2?.data) {
    return 0;
  }

  const instruments1 = new Set(Object.keys(pattern1.data));
  const instruments2 = new Set(Object.keys(pattern2.data));
  
  // Ortak enstrüman sayısı
  const commonInstruments = [...instruments1].filter(x => instruments2.has(x));
  const totalInstruments = new Set([...instruments1, ...instruments2]).size;
  
  if (totalInstruments === 0) {
    return 1; // İkisi de boş
  }

  const instrumentSimilarity = commonInstruments.length / totalInstruments;
  
  // Nota sayısı benzerliği
  const analysis1 = analyzePatternDensity(pattern1);
  const analysis2 = analyzePatternDensity(pattern2);
  
  const maxNotes = Math.max(analysis1.totalNotes, analysis2.totalNotes);
  const minNotes = Math.min(analysis1.totalNotes, analysis2.totalNotes);
  
  const noteSimilarity = maxNotes === 0 ? 1 : minNotes / maxNotes;
  
  // Ortalama benzerlik
  return (instrumentSimilarity + noteSimilarity) / 2;
};

/**
 * Pattern'dan istatistikler çıkarır
 * @param {Object} pattern - Pattern objesi
 * @returns {Object} - İstatistikler
 */
export const getPatternStats = (pattern) => {
  const analysis = analyzePatternDensity(pattern);
  const length = calculatePatternLoopLength(pattern);
  
  let pitchRange = { min: 127, max: 0 };
  let velocityRange = { min: 1, max: 0 };
  let rhythmPattern = [];
  
  if (pattern?.data) {
    Object.values(pattern.data).forEach(notes => {
      if (Array.isArray(notes)) {
        notes.forEach(note => {
          // Pitch analizi (MIDI formatında)
          if (typeof note.pitch === 'string') {
            const midiNote = pitchToMidi(note.pitch);
            pitchRange.min = Math.min(pitchRange.min, midiNote);
            pitchRange.max = Math.max(pitchRange.max, midiNote);
          }
          
          // Velocity analizi
          if (typeof note.velocity === 'number') {
            velocityRange.min = Math.min(velocityRange.min, note.velocity);
            velocityRange.max = Math.max(velocityRange.max, note.velocity);
          }
          
          // Ritim analizi
          if (typeof note.time === 'number') {
            rhythmPattern.push(note.time);
          }
        });
      }
    });
  }

  return {
    ...analysis,
    length,
    pitchRange: pitchRange.max > 0 ? pitchRange : { min: 60, max: 60 },
    velocityRange: velocityRange.max > 0 ? velocityRange : { min: 0.8, max: 0.8 },
    rhythmComplexity: calculateRhythmComplexity(rhythmPattern),
    barsCount: Math.ceil(length / 16),
    estimatedDuration: `${Math.ceil(length / 16)} bars`
  };
};

/**
 * Ritim karmaşıklığını hesaplar
 * @param {Array} timings - Zaman dizisi
 * @returns {string} - Karmaşıklık seviyesi
 */
const calculateRhythmComplexity = (timings) => {
  if (timings.length === 0) return 'none';
  
  // Benzersiz zamanlamaların sayısı
  const uniqueTimings = new Set(timings).size;
  const ratio = uniqueTimings / timings.length;
  
  if (ratio < 0.3) return 'simple';
  if (ratio < 0.6) return 'moderate';
  return 'complex';
};

/**
 * Pitch string'ini MIDI numarasına çevirir
 * @param {string} pitch - "C4" formatında pitch
 * @returns {number} - MIDI numarası
 */
const pitchToMidi = (pitch) => {
  const noteNames = { 
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 
  };
  
  const match = pitch.match(/([A-G]#?)(\d+)/);
  if (!match) return 60; // C4
  
  const noteName = match[1];
  const octave = parseInt(match[2]);
  
  return (octave + 1) * 12 + (noteNames[noteName] || 0);
};

// Enhanced Pattern Utils
export const EnhancedPatternUtils = {
  // Smart loop calculation based on content density
  calculateSmartLoopLength: (pattern, mode = 'auto') => {
    if (!pattern?.data) return 16;
    
    const analysis = analyzePatternDensity(pattern);
    const baseLength = calculatePatternLoopLength(pattern);
    
    switch (mode) {
      case 'tight':
        // Minimum loop that contains all content
        return baseLength;
        
      case 'extended':
        // Add extra space for breathing room
        return Math.max(32, baseLength + 16);
        
      case 'auto':
      default:
        // Smart calculation based on density
        if (analysis.density === 'very-dense' || analysis.density === 'dense') {
          return baseLength;
        } else if (analysis.density === 'medium') {
          return Math.max(32, baseLength + 8);
        } else {
          return Math.max(32, baseLength + 16);
        }
    }
  },

  // Calculate song sections
  calculateSongSections: (clips) => {
    if (!Array.isArray(clips) || clips.length === 0) {
      return [{ name: 'Empty', start: 0, end: 64, type: 'empty' }];
    }
    
    const sections = [];
    let currentPos = 0;
    
    // Sort clips by start time
    const sortedClips = [...clips].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    
    sortedClips.forEach((clip, index) => {
      const clipStart = (clip.startTime || 0) * 16;
      const clipEnd = clipStart + ((clip.duration || 4) * 16);
      
      // Add gap if there's space before this clip
      if (clipStart > currentPos) {
        sections.push({
          name: 'Gap',
          start: currentPos,
          end: clipStart,
          type: 'gap'
        });
      }
      
      // Add the clip section
      sections.push({
        name: clip.name || `Clip ${index + 1}`,
        start: clipStart,
        end: clipEnd,
        type: 'clip',
        clipId: clip.id,
        patternId: clip.patternId
      });
      
      currentPos = Math.max(currentPos, clipEnd);
    });
    
    return sections;
  },

  // Find optimal loop points
  findOptimalLoopPoints: (content, contentType = 'pattern') => {
    if (contentType === 'pattern') {
      const length = calculatePatternLoopLength(content);
      return { start: 0, end: length };
    } else {
      // Song mode - find natural loop points
      const sections = EnhancedPatternUtils.calculateSongSections(content);
      const totalLength = Math.max(...sections.map(s => s.end));
      
      // Look for power-of-2 loop points that make musical sense
      const candidates = [16, 32, 64, 128, 256];
      const bestLength = candidates.find(len => len >= totalLength) || totalLength;
      
      return { start: 0, end: bestLength };
    }
  }
};

// Export individual functions for backward compatibility
export {
  calculateRhythmComplexity,
  pitchToMidi
};