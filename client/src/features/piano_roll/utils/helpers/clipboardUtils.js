export const copyNotesToClipboard = (notes) => {
  if (!notes || notes.length === 0) return null;
  
  const clipboardData = {
    notes: notes.map(note => ({ ...note })),
    timestamp: Date.now(),
    type: 'piano-roll-notes'
  };
  
  try {
    localStorage.setItem('pianoRollClipboard', JSON.stringify(clipboardData));
    return clipboardData;
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error);
    return null;
  }
};

export const pasteNotesFromClipboard = (pasteTime = 0) => {
  try {
    const clipboardData = JSON.parse(localStorage.getItem('pianoRollClipboard') || '{}');
    
    if (!clipboardData.notes || clipboardData.type !== 'piano-roll-notes') {
      return null;
    }
    
    const firstNoteTime = Math.min(...clipboardData.notes.map(n => n.time));
    const timeOffset = pasteTime - firstNoteTime;
    
    return clipboardData.notes.map(note => ({
      ...note,
      id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: note.time + timeOffset
    }));
  } catch (error) {
    console.warn('Failed to paste from clipboard:', error);
    return null;
  }
};

export const clearClipboard = () => {
  try {
    localStorage.removeItem('pianoRollClipboard');
  } catch (error) {
    console.warn('Failed to clear clipboard:', error);
  }
};

export const hasClipboardData = () => {
  try {
    const clipboardData = JSON.parse(localStorage.getItem('pianoRollClipboard') || '{}');
    return clipboardData.type === 'piano-roll-notes' && Array.isArray(clipboardData.notes);
  } catch (error) {
    return false;
  }
};
