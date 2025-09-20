export class NotePool {
  constructor(initialSize = 100) {
    this.pool = [];
    this.active = new Map();
    
    // Pre-allocate note objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createNoteObject());
    }
  }
  
  createNoteObject() {
    return {
      id: '',
      time: 0,
      pitch: 'C4',
      duration: '16n',
      velocity: 0.8,
      _pooled: true
    };
  }
  
  acquire(noteData) {
    let note;
    
    if (this.pool.length > 0) {
      note = this.pool.pop();
    } else {
      note = this.createNoteObject();
    }
    
    // Reset and populate with new data
    Object.assign(note, noteData);
    this.active.set(note.id, note);
    
    return note;
  }
  
  release(noteId) {
    const note = this.active.get(noteId);
    if (note && note._pooled) {
      this.active.delete(noteId);
      
      // Reset to default values
      note.id = '';
      note.time = 0;
      note.pitch = 'C4';
      note.duration = '16n';
      note.velocity = 0.8;
      
      this.pool.push(note);
    }
  }
  
  clear() {
    this.active.forEach((_, noteId) => this.release(noteId));
  }
  
  getActiveCount() {
    return this.active.size;
  }
  
  getPoolSize() {
    return this.pool.length;
  }
}

export const createMemoizer = (maxSize = 100) => {
  const cache = new Map();
  
  return {
    memoize: (key, computeFn) => {
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = computeFn();
      
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      cache.set(key, result);
      return result;
    },
    
    clear: () => cache.clear(),
    
    size: () => cache.size
  };
};
