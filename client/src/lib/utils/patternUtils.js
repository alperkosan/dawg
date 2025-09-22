export const EnhancedPatternUtils = {
  // ✅ NEW: Smart loop calculation based on content density
  calculateSmartLoopLength: (pattern, mode = 'auto') => {
    if (!pattern?.data) return 16;
    
    let noteCount = 0;
    let lastNoteTime = 0;
    let density = 0;
    
    Object.values(pattern.data).forEach(notes => {
      if (Array.isArray(notes)) {
        noteCount += notes.length;
        notes.forEach(note => {
          lastNoteTime = Math.max(lastNoteTime, note.time || 0);
        });
      }
    });
    
    density = noteCount / Math.max(lastNoteTime, 1);
    
    switch (mode) {
      case 'tight':
        // Minimum loop that contains all content
        return Math.max(16, Math.ceil(lastNoteTime / 16) * 16);
        
      case 'extended':
        // Add extra space for breathing room
        return Math.max(32, Math.ceil(lastNoteTime / 16) * 16 + 16);
        
      case 'auto':
      default:
        // Smart calculation based on density
        if (density > 2) {
          return Math.max(16, Math.ceil(lastNoteTime / 16) * 16);
        } else {
          return Math.max(32, Math.ceil(lastNoteTime / 16) * 16 + 16);
        }
    }
  },

  // ✅ NEW: Calculate song sections
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

  // ✅ NEW: Find optimal loop points
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