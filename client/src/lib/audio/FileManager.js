/**
 * 📁 FILE MANAGER
 *
 * Comprehensive file management system for audio projects
 * Handles upload, download, organization, and batch operations
 */

export class FileManager {
  constructor() {
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.supportedFormats = [
      'audio/wav',
      'audio/mpeg',
      'audio/ogg',
      'audio/flac',
      'audio/aiff',
      'audio/x-wav',
      'audio/mp3'
    ];

    this.projectFiles = new Map(); // file_id -> file_info
    this.collections = new Map(); // collection_id -> file_ids[]
    this.tags = new Map(); // tag -> file_ids[]

    console.log('📁 FileManager initialized');
  }

  // =================== FILE UPLOAD & IMPORT ===================

  /**
   * Upload and process multiple audio files
   * @param {FileList|Array} files - Files to upload
   * @param {object} options - Upload options
   * @returns {Promise<Array>} Upload results
   */
  async uploadFiles(files, options = {}) {
    const {
      collection = 'default',
      tags = [],
      autoAnalyze = true,
      createInstruments = false
    } = options;

    console.log(`📁 Uploading ${files.length} files to collection: ${collection}`);

    const results = [];

    for (const file of files) {
      try {
        const result = await this.uploadSingleFile(file, {
          collection,
          tags,
          autoAnalyze,
          createInstruments
        });
        results.push(result);
      } catch (error) {
        console.error(`📁 Failed to upload ${file.name}:`, error);
        results.push({
          success: false,
          filename: file.name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Upload single audio file
   */
  async uploadSingleFile(file, options = {}) {
    // Validate file
    this._validateFile(file);

    // Generate unique file ID
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Read file as ArrayBuffer
    const arrayBuffer = await this._readFileAsArrayBuffer(file);

    // Decode audio
    const audioBuffer = await this._decodeAudioFile(arrayBuffer);

    // Analyze audio if requested
    let analysis = null;
    if (options.autoAnalyze) {
      analysis = await this._analyzeAudioFile(audioBuffer);
    }

    // Create file info
    const fileInfo = {
      id: fileId,
      name: file.name,
      originalName: file.name,
      size: file.size,
      type: file.type,
      uploadDate: new Date().toISOString(),
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      audioBuffer: audioBuffer,
      arrayBuffer: arrayBuffer,
      analysis: analysis,
      tags: [...(options.tags || [])],
      collection: options.collection || 'default',
      metadata: {
        bpm: analysis?.bpm || null,
        key: analysis?.key || null,
        loudness: analysis?.loudness || null
      }
    };

    // Store file
    this.projectFiles.set(fileId, fileInfo);

    // Add to collection
    this._addToCollection(fileId, fileInfo.collection);

    // Add tags
    for (const tag of fileInfo.tags) {
      this._addTag(fileId, tag);
    }

    // Create instrument if requested
    if (options.createInstruments) {
      await this._createInstrumentFromFile(fileInfo);
    }

    console.log(`📁 Uploaded: ${file.name} (${fileId})`);

    return {
      success: true,
      fileId: fileId,
      fileInfo: fileInfo
    };
  }

  // =================== FILE DOWNLOAD & EXPORT ===================

  /**
   * Download file by ID
   */
  async downloadFile(fileId, filename = null) {
    const fileInfo = this.projectFiles.get(fileId);
    if (!fileInfo) {
      throw new Error(`File ${fileId} not found`);
    }

    const blob = new Blob([fileInfo.arrayBuffer], { type: fileInfo.type });
    const url = URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || fileInfo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(url);

    console.log(`📁 Downloaded: ${fileInfo.name}`);
  }

  /**
   * Save audio file (blob) to downloads
   */
  async saveAudioFile(blob, filename) {
    const url = URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(url);

    const fileInfo = {
      filename: filename,
      size: blob.size,
      type: blob.type,
      downloadDate: new Date().toISOString(),
      url: url
    };

    console.log(`📁 Saved audio file: ${filename}`);
    return fileInfo;
  }

  // =================== FILE ORGANIZATION ===================

  /**
   * Create new collection
   */
  createCollection(name, description = '') {
    const collectionId = `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.collections.set(collectionId, {
      id: collectionId,
      name,
      description,
      files: [],
      createdDate: new Date().toISOString()
    });

    console.log(`📁 Created collection: ${name} (${collectionId})`);
    return collectionId;
  }

  /**
   * Add file to collection
   */
  _addToCollection(fileId, collectionName) {
    // Find or create collection
    let collection = Array.from(this.collections.values())
      .find(col => col.name === collectionName);

    if (!collection) {
      const collectionId = this.createCollection(collectionName);
      collection = this.collections.get(collectionId);
    }

    if (!collection.files.includes(fileId)) {
      collection.files.push(fileId);
    }
  }

  /**
   * Add tag to file
   */
  _addTag(fileId, tag) {
    if (!this.tags.has(tag)) {
      this.tags.set(tag, []);
    }

    const taggedFiles = this.tags.get(tag);
    if (!taggedFiles.includes(fileId)) {
      taggedFiles.push(fileId);
    }
  }

  /**
   * Search files by various criteria
   */
  searchFiles(query = {}) {
    const {
      name = null,
      tags = [],
      collection = null,
      type = null,
      minDuration = null,
      maxDuration = null,
      bpm = null
    } = query;

    let results = Array.from(this.projectFiles.values());

    // Filter by name
    if (name) {
      const searchTerm = name.toLowerCase();
      results = results.filter(file =>
        file.name.toLowerCase().includes(searchTerm) ||
        file.originalName.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by tags
    if (tags.length > 0) {
      results = results.filter(file =>
        tags.some(tag => file.tags.includes(tag))
      );
    }

    // Filter by collection
    if (collection) {
      results = results.filter(file => file.collection === collection);
    }

    // Filter by type
    if (type) {
      results = results.filter(file => file.type === type);
    }

    // Filter by duration
    if (minDuration !== null) {
      results = results.filter(file => file.duration >= minDuration);
    }

    if (maxDuration !== null) {
      results = results.filter(file => file.duration <= maxDuration);
    }

    // Filter by BPM
    if (bpm !== null) {
      results = results.filter(file => {
        const fileBpm = file.metadata?.bpm;
        return fileBpm && Math.abs(fileBpm - bpm) < 5; // ±5 BPM tolerance
      });
    }

    return results;
  }

  // =================== BATCH OPERATIONS ===================

  /**
   * Batch download multiple files as ZIP
   */
  async batchDownloadFiles(fileIds, zipName = 'audio_files.zip') {
    // Note: This would require a ZIP library like JSZip
    // For now, download files individually
    console.log(`📁 Batch downloading ${fileIds.length} files`);

    const results = [];
    for (const fileId of fileIds) {
      try {
        await this.downloadFile(fileId);
        results.push({ fileId, success: true });
      } catch (error) {
        results.push({ fileId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Batch tag multiple files
   */
  batchTagFiles(fileIds, tags) {
    const results = [];

    for (const fileId of fileIds) {
      try {
        const fileInfo = this.projectFiles.get(fileId);
        if (!fileInfo) throw new Error('File not found');

        // Add new tags
        for (const tag of tags) {
          if (!fileInfo.tags.includes(tag)) {
            fileInfo.tags.push(tag);
            this._addTag(fileId, tag);
          }
        }

        results.push({ fileId, success: true });
      } catch (error) {
        results.push({ fileId, success: false, error: error.message });
      }
    }

    console.log(`📁 Batch tagged ${results.filter(r => r.success).length} files`);
    return results;
  }

  /**
   * Batch delete multiple files
   */
  batchDeleteFiles(fileIds) {
    const results = [];

    for (const fileId of fileIds) {
      try {
        this.deleteFile(fileId);
        results.push({ fileId, success: true });
      } catch (error) {
        results.push({ fileId, success: false, error: error.message });
      }
    }

    console.log(`📁 Batch deleted ${results.filter(r => r.success).length} files`);
    return results;
  }

  // =================== FILE OPERATIONS ===================

  /**
   * Delete file
   */
  deleteFile(fileId) {
    const fileInfo = this.projectFiles.get(fileId);
    if (!fileInfo) {
      throw new Error(`File ${fileId} not found`);
    }

    // Remove from collections
    for (const collection of this.collections.values()) {
      const index = collection.files.indexOf(fileId);
      if (index !== -1) {
        collection.files.splice(index, 1);
      }
    }

    // Remove from tags
    for (const [tag, fileIds] of this.tags.entries()) {
      const index = fileIds.indexOf(fileId);
      if (index !== -1) {
        fileIds.splice(index, 1);
        if (fileIds.length === 0) {
          this.tags.delete(tag);
        }
      }
    }

    // Remove from project files
    this.projectFiles.delete(fileId);

    console.log(`📁 Deleted file: ${fileInfo.name}`);
  }

  /**
   * Get file info
   */
  getFileInfo(fileId) {
    return this.projectFiles.get(fileId);
  }

  /**
   * Get all files
   */
  getAllFiles() {
    return Array.from(this.projectFiles.values());
  }

  /**
   * Get collection files
   */
  getCollectionFiles(collectionName) {
    const collection = Array.from(this.collections.values())
      .find(col => col.name === collectionName);

    if (!collection) return [];

    return collection.files.map(fileId => this.projectFiles.get(fileId))
      .filter(Boolean);
  }

  /**
   * Get files by tag
   */
  getFilesByTag(tag) {
    const fileIds = this.tags.get(tag) || [];
    return fileIds.map(fileId => this.projectFiles.get(fileId))
      .filter(Boolean);
  }

  // =================== UTILITY METHODS ===================

  /**
   * Validate uploaded file
   */
  _validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    if (!this.supportedFormats.includes(file.type)) {
      throw new Error(`Unsupported format: ${file.type}`);
    }
  }

  /**
   * Read file as ArrayBuffer
   */
  _readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Decode audio file
   */
  async _decodeAudioFile(arrayBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to decode audio: ${error.message}`);
    }
  }

  /**
   * Analyze audio file
   */
  async _analyzeAudioFile(audioBuffer) {
    // Basic audio analysis
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const duration = length / sampleRate;

    // Calculate peak and RMS
    let peak = 0;
    let rmsSum = 0;

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const sample = Math.abs(channelData[i]);
        peak = Math.max(peak, sample);
        rmsSum += sample * sample;
      }
    }

    const rms = Math.sqrt(rmsSum / (length * numberOfChannels));
    const loudness = 20 * Math.log10(rms + 1e-10); // LUFS approximation

    return {
      duration,
      peak,
      rms,
      loudness,
      dynamicRange: peak / (rms + 1e-10),
      sampleRate,
      channels: numberOfChannels,
      samples: length,
      // TODO: Add BPM detection, key detection, onset detection
      bpm: null,
      key: null,
      onsets: []
    };
  }

  /**
   * Create instrument from uploaded file
   */
  async _createInstrumentFromFile(fileInfo) {
    try {
      // Import store dynamically to avoid circular dependencies
      const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');

      const sampleData = {
        name: fileInfo.name,
        url: URL.createObjectURL(new Blob([fileInfo.arrayBuffer], { type: fileInfo.type })),
        type: 'sample',
        duration: fileInfo.duration,
        tags: fileInfo.tags
      };

      useInstrumentsStore.getState().handleAddNewInstrument(sampleData);
      console.log(`📁 Created instrument from file: ${fileInfo.name}`);

    } catch (error) {
      console.error('📁 Failed to create instrument:', error);
    }
  }

  // =================== STATISTICS ===================

  /**
   * Get file statistics
   */
  getStats() {
    const files = Array.from(this.projectFiles.values());

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalDuration = files.reduce((sum, file) => sum + file.duration, 0);

    const formatCounts = {};
    files.forEach(file => {
      formatCounts[file.type] = (formatCounts[file.type] || 0) + 1;
    });

    return {
      totalFiles,
      totalSize,
      totalDuration,
      formatCounts,
      collections: this.collections.size,
      tags: this.tags.size,
      averageFileSize: totalFiles > 0 ? totalSize / totalFiles : 0,
      averageDuration: totalFiles > 0 ? totalDuration / totalFiles : 0
    };
  }
}

export default FileManager;