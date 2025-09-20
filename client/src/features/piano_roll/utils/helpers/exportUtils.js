export const exportNotesToMIDI = (notes, options = {}) => {
  const {
    ticksPerQuarter = 480,
    bpm = 120,
    trackName = 'Piano Roll'
  } = options;
  
  // This would integrate with a MIDI library like JZZ or tonejs/midi
  console.log('Export to MIDI:', { notes, options });
  
  // Placeholder implementation
  return {
    format: 'midi',
    tracks: [{
      name: trackName,
      notes: notes.map(note => ({
        ...note,
        ticks: note.time * (ticksPerQuarter / 4) // Convert steps to ticks
      }))
    }]
  };
};

export const exportNotesToJSON = (notes) => {
  return JSON.stringify(notes, null, 2);
};

export const exportNotesToCSV = (notes) => {
  const header = 'time,pitch,duration,velocity\n';
  const rows = notes.map(note => 
    `${note.time},${note.pitch},${note.duration},${note.velocity}`
  ).join('\n');
  
  return header + rows;
};

export const importNotesFromJSON = (jsonString) => {
  try {
    const notes = JSON.parse(jsonString);
    
    if (!Array.isArray(notes)) {
      throw new Error('Invalid JSON format: expected array of notes');
    }
    
    return notes.map(note => ({
      id: note.id || `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: Number(note.time) || 0,
      pitch: note.pitch || 'C4',
      duration: note.duration || '16n',
      velocity: Number(note.velocity) || 0.8
    }));
  } catch (error) {
    console.error('Failed to import notes from JSON:', error);
    return null;
  }
};
