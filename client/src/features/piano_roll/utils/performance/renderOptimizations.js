export class ViewportCuller {
  constructor(marginX = 200, marginY = 100) {
    this.marginX = marginX;
    this.marginY = marginY;
  }
  
  cullNotes(notes, viewport) {
    const bounds = {
      left: viewport.scrollX - this.marginX,
      right: viewport.scrollX + viewport.containerWidth + this.marginX,
      top: viewport.scrollY - this.marginY,
      bottom: viewport.scrollY + viewport.containerHeight + this.marginY
    };
    
    return notes.filter(note => {
      const rect = viewport.getNoteRect(note);
      return (
        rect.x < bounds.right &&
        rect.x + rect.width > bounds.left &&
        rect.y < bounds.bottom &&
        rect.y + rect.height > bounds.top
      );
    });
  }
  
  updateMargins(marginX, marginY) {
    this.marginX = marginX;
    this.marginY = marginY;
  }
}

export const createVirtualizedRenderer = (itemHeight, containerHeight) => {
  return {
    getVisibleRange: (scrollTop, totalItems) => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        totalItems,
        Math.ceil((scrollTop + containerHeight) / itemHeight)
      );
      
      return { startIndex, endIndex };
    },
    
    getItemStyle: (index) => ({
      position: 'absolute',
      top: index * itemHeight,
      left: 0,
      right: 0,
      height: itemHeight
    })
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const debounce = (func, delay) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};
