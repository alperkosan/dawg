// lib/core/StorePipeline.js OLUŞTUR
export class StorePipeline {
    constructor() {
      this.pendingUpdates = new Map();
      this.batchTimeout = null;
      this.isProcessing = false;
    }
    
    // Kritik: Tüm store güncellemelerini batch'le
    scheduleUpdate(storeType, updateFn, priority = 'normal') {
      if (!this.pendingUpdates.has(storeType)) {
        this.pendingUpdates.set(storeType, []);
      }
      
      this.pendingUpdates.get(storeType).push({
        updateFn,
        priority,
        timestamp: performance.now()
      });
      
      // Yüksek öncelikli güncellemeleri anında işle
      if (priority === 'urgent') {
        this.processBatch();
      } else {
        this.scheduleBatch();
      }
    }
    
    scheduleBatch() {
      if (this.batchTimeout) return;
      
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, 16); // ~60fps
    }
    
    processBatch() {
      if (this.isProcessing) return;
      this.isProcessing = true;
      
      try {
        // Öncelik sırasına göre işle
        const urgentUpdates = [];
        const normalUpdates = [];
        
        for (const [storeType, updates] of this.pendingUpdates) {
          updates.forEach(update => {
            if (update.priority === 'urgent') {
              urgentUpdates.push({ storeType, ...update });
            } else {
              normalUpdates.push({ storeType, ...update });
            }
          });
        }
        
        // Urgent'ları önce işle
        [...urgentUpdates, ...normalUpdates].forEach(({ updateFn }) => {
          updateFn();
        });
        
        this.pendingUpdates.clear();
      } finally {
        this.isProcessing = false;
        this.batchTimeout = null;
      }
    }
  }
  
  export const storePipeline = new StorePipeline();