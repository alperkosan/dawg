// lib/utils/objectPool.js
// High-performance object pooling for Piano Roll - Reduces GC pressure

/**
 * Generic object pool for reusing objects and reducing garbage collection
 */
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.activeObjects = new Set();

    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /**
   * Get an object from the pool
   */
  get() {
    let obj;

    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }

    this.activeObjects.add(obj);
    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj) {
    if (this.activeObjects.has(obj)) {
      this.activeObjects.delete(obj);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  /**
   * Release all active objects back to pool
   */
  releaseAll() {
    for (const obj of this.activeObjects) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    this.activeObjects.clear();
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.activeObjects.size,
      totalAllocated: this.pool.length + this.activeObjects.size
    };
  }
}

// ==========================================================================
// PIANO ROLL SPECIFIC POOLS
// ==========================================================================

/**
 * Rectangle object pool for note positioning calculations
 */
const rectanglePool = new ObjectPool(
  // Create function
  () => ({ x: 0, y: 0, width: 0, height: 0 }),
  // Reset function
  (rect) => {
    rect.x = 0;
    rect.y = 0;
    rect.width = 0;
    rect.height = 0;
  },
  100 // Pre-allocate 100 rectangles
);

/**
 * Point object pool for mouse/touch coordinates
 */
const pointPool = new ObjectPool(
  // Create function
  () => ({ x: 0, y: 0 }),
  // Reset function
  (point) => {
    point.x = 0;
    point.y = 0;
  },
  50 // Pre-allocate 50 points
);

/**
 * Musical position object pool for time/pitch calculations
 */
const musicalPositionPool = new ObjectPool(
  // Create function
  () => ({ time: 0, pitch: '', bar: 0, beat: 0, step: 0 }),
  // Reset function
  (pos) => {
    pos.time = 0;
    pos.pitch = '';
    pos.bar = 0;
    pos.beat = 0;
    pos.step = 0;
  },
  30
);

/**
 * Note data object pool for temporary note calculations
 */
const noteDataPool = new ObjectPool(
  // Create function
  () => ({
    id: '',
    time: 0,
    pitch: '',
    duration: 0,
    velocity: 1,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }),
  // Reset function
  (note) => {
    note.id = '';
    note.time = 0;
    note.pitch = '';
    note.duration = 0;
    note.velocity = 1;
    note.x = 0;
    note.y = 0;
    note.width = 0;
    note.height = 0;
  },
  200 // Notes are frequently allocated
);

/**
 * Viewport bounds object pool for culling calculations
 */
const viewportPool = new ObjectPool(
  // Create function
  () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  // Reset function
  (viewport) => {
    viewport.left = 0;
    viewport.right = 0;
    viewport.top = 0;
    viewport.bottom = 0;
    viewport.width = 0;
    viewport.height = 0;
  },
  20
);

// ==========================================================================
// HIGH-LEVEL HELPER FUNCTIONS
// ==========================================================================

/**
 * Get a rectangle from pool and set its properties
 */
export const getRectangle = (x = 0, y = 0, width = 0, height = 0) => {
  const rect = rectanglePool.get();
  rect.x = x;
  rect.y = y;
  rect.width = width;
  rect.height = height;
  return rect;
};

/**
 * Return rectangle to pool
 */
export const releaseRectangle = (rect) => {
  rectanglePool.release(rect);
};

/**
 * Get a point from pool and set its coordinates
 */
export const getPoint = (x = 0, y = 0) => {
  const point = pointPool.get();
  point.x = x;
  point.y = y;
  return point;
};

/**
 * Return point to pool
 */
export const releasePoint = (point) => {
  pointPool.release(point);
};

/**
 * Get a musical position from pool
 */
export const getMusicalPosition = (time = 0, pitch = '', bar = 0, beat = 0, step = 0) => {
  const pos = musicalPositionPool.get();
  pos.time = time;
  pos.pitch = pitch;
  pos.bar = bar;
  pos.beat = beat;
  pos.step = step;
  return pos;
};

/**
 * Return musical position to pool
 */
export const releaseMusicalPosition = (pos) => {
  musicalPositionPool.release(pos);
};

/**
 * Get a note data object from pool
 */
export const getNoteData = (id = '', time = 0, pitch = '', duration = 0, velocity = 1) => {
  const note = noteDataPool.get();
  note.id = id;
  note.time = time;
  note.pitch = pitch;
  note.duration = duration;
  note.velocity = velocity;
  return note;
};

/**
 * Return note data to pool
 */
export const releaseNoteData = (note) => {
  noteDataPool.release(note);
};

/**
 * Get a viewport bounds object from pool
 */
export const getViewport = (left = 0, right = 0, top = 0, bottom = 0) => {
  const viewport = viewportPool.get();
  viewport.left = left;
  viewport.right = right;
  viewport.top = top;
  viewport.bottom = bottom;
  viewport.width = right - left;
  viewport.height = bottom - top;
  return viewport;
};

/**
 * Return viewport to pool
 */
export const releaseViewport = (viewport) => {
  viewportPool.release(viewport);
};

// ==========================================================================
// BATCH OPERATIONS FOR PERFORMANCE
// ==========================================================================

/**
 * Process multiple rectangles efficiently using pooled objects
 * Automatically manages pool allocation/deallocation
 */
export const withPooledRectangles = (count, processFn) => {
  const rectangles = [];

  // Allocate from pool
  for (let i = 0; i < count; i++) {
    rectangles.push(rectanglePool.get());
  }

  try {
    // Execute processing function
    return processFn(rectangles);
  } finally {
    // Always return to pool
    rectangles.forEach(rect => rectanglePool.release(rect));
  }
};

/**
 * Process multiple notes efficiently using pooled objects
 */
export const withPooledNotes = (count, processFn) => {
  const notes = [];

  // Allocate from pool
  for (let i = 0; i < count; i++) {
    notes.push(noteDataPool.get());
  }

  try {
    return processFn(notes);
  } finally {
    // Return all to pool
    notes.forEach(note => noteDataPool.release(note));
  }
};

// ==========================================================================
// MEMORY MONITORING AND CLEANUP
// ==========================================================================

/**
 * Get comprehensive pool statistics for performance monitoring
 */
export const getPoolStats = () => {
  return {
    rectangles: rectanglePool.getStats(),
    points: pointPool.getStats(),
    musicalPositions: musicalPositionPool.getStats(),
    noteData: noteDataPool.getStats(),
    viewports: viewportPool.getStats()
  };
};

/**
 * Release all objects back to pools (emergency cleanup)
 */
export const releaseAllPools = () => {
  rectanglePool.releaseAll();
  pointPool.releaseAll();
  musicalPositionPool.releaseAll();
  noteDataPool.releaseAll();
  viewportPool.releaseAll();
};

/**
 * Debug: Log pool statistics to console
 */
export const logPoolStats = () => {
  const stats = getPoolStats();
  console.log('🏊 Object Pool Statistics:', stats);

  // Calculate total memory usage approximation
  const totalActive = Object.values(stats).reduce((sum, pool) => sum + pool.activeCount, 0);
  const totalPooled = Object.values(stats).reduce((sum, pool) => sum + pool.poolSize, 0);

  console.log(`📊 Total Objects: ${totalActive} active, ${totalPooled} pooled`);
};

// ==========================================================================
// PIANO ROLL SPECIFIC OPTIMIZATIONS
// ==========================================================================

/**
 * Calculate note rectangles with pooled objects for better performance
 */
export const calculateNoteRectsOptimized = (notes, engine) => {
  return withPooledRectangles(notes.length, (rectangles) => {
    return notes.map((note, index) => {
      const rect = rectangles[index];

      // Use engine converters to calculate position
      const x = engine.timeToX(note.time);
      const y = engine.pitchToY(note.pitch);
      const width = Math.max(4, (note.duration * engine.stepWidth) - 1);
      const height = engine.keyHeight - 1;

      // Set rectangle properties
      rect.x = x;
      rect.y = y;
      rect.width = width;
      rect.height = height;

      // Return a copy since we're about to release the pooled object
      return { ...rect };
    });
  });
};

/**
 * Calculate visible notes using pooled viewport object
 */
export const getVisibleNotesOptimized = (notes, engine) => {
  const viewport = getViewport(
    engine.scroll.x,
    engine.scroll.x + engine.size.width,
    engine.scroll.y,
    engine.scroll.y + engine.size.height
  );

  try {
    return notes.filter(note => {
      const noteRect = engine.getNoteRect(note);
      return !(noteRect.x + noteRect.width < viewport.left ||
               noteRect.x > viewport.right ||
               noteRect.y + noteRect.height < viewport.top ||
               noteRect.y > viewport.bottom);
    });
  } finally {
    releaseViewport(viewport);
  }
};

// Export individual pools for advanced usage
export {
  rectanglePool,
  pointPool,
  musicalPositionPool,
  noteDataPool,
  viewportPool,
  ObjectPool
};