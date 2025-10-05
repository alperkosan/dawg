/**
 *  AUDIO FILE BROWSER
 *
 * Advanced audio file browser with:
 * - File upload and organization
 * - Collection management
 * - Audio preview
 * - Metadata display
 * - Drag and drop to arrangement
 * - File analysis and tagging
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  Upload, FolderOpen, Play, Pause, Volume2, Clock,
  FileAudio, Search, Filter, Grid, List, MoreVertical,
  Tag, Download, Trash2, Copy, Edit3, Music
} from 'lucide-react';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';

const AudioFileBrowser = () => {
  const {
    audioFileBrowser,
    toggleAudioFileBrowser,
    addUploadedFiles,
    setAudioFileCollection,
    selectAudioFiles,
    getFilteredAudioFiles
  } = useArrangementWorkspaceStore();

  const fileInputRef = useRef(null);

  // Local state
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [previewingFile, setPreviewingFile] = useState(null);
  const [draggedFile, setDraggedFile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get filtered files
  const filteredFiles = useMemo(() => {
    let files = getFilteredAudioFiles();

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      files = files.filter(file =>
        file.name.toLowerCase().includes(query) ||
        file.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return files;
  }, [getFilteredAudioFiles, searchQuery]);

  // =================== FILE UPLOAD ===================

  const handleFileUpload = async (files) => {
    const uploadedFiles = [];

    for (const file of files) {
      try {
        // Analyze audio file
        const audioBuffer = await analyzeAudioFile(file);

        const uploadedFile = {
          id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          uploadedAt: Date.now(),
          audioBuffer,
          collection: 'uploads',
          tags: await generateAudioTags(file, audioBuffer),
          metadata: {
            bitRate: 0, // TODO: Calculate
            format: file.type.split('/')[1],
            quality: getAudioQuality(audioBuffer)
          }
        };

        uploadedFiles.push(uploadedFile);
      } catch (error) {
        console.error('Failed to process audio file:', file.name, error);
      }
    }

    if (uploadedFiles.length > 0) {
      addUploadedFiles(uploadedFiles);
      console.log(` Uploaded ${uploadedFiles.length} audio files`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('audio/')
    );

    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // =================== AUDIO ANALYSIS ===================

  const analyzeAudioFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(e.target.result);
          resolve(audioBuffer);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const generateAudioTags = async (file, audioBuffer) => {
    const tags = [];

    // Duration-based tags
    if (audioBuffer.duration < 5) tags.push('short');
    else if (audioBuffer.duration > 30) tags.push('long');

    // Channel-based tags
    if (audioBuffer.numberOfChannels === 1) tags.push('mono');
    else if (audioBuffer.numberOfChannels === 2) tags.push('stereo');

    // File type tags
    const fileType = file.type.split('/')[1];
    tags.push(fileType);

    // Name-based tags
    const fileName = file.name.toLowerCase();
    if (fileName.includes('drum')) tags.push('drums');
    if (fileName.includes('bass')) tags.push('bass');
    if (fileName.includes('lead')) tags.push('lead');
    if (fileName.includes('vocal')) tags.push('vocals');
    if (fileName.includes('loop')) tags.push('loop');
    if (fileName.includes('one')) tags.push('one-shot');

    return tags;
  };

  const getAudioQuality = (audioBuffer) => {
    if (audioBuffer.sampleRate >= 48000) return 'high';
    if (audioBuffer.sampleRate >= 44100) return 'standard';
    return 'low';
  };

  // =================== FILE OPERATIONS ===================

  const handleFilePreview = (fileId) => {
    if (previewingFile === fileId) {
      setPreviewingFile(null);
      // TODO: Stop audio preview
    } else {
      setPreviewingFile(fileId);
      // TODO: Start audio preview
    }
  };

  const handleFileDragStart = (e, file) => {
    setDraggedFile(file);
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'audioFile',
      fileId: file.id,
      source: 'browser'
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFileDragEnd = () => {
    setDraggedFile(null);
  };

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    setContextMenu({
      file,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // =================== RENDER HELPERS ===================

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (file) => {
    if (file.type.includes('wav')) return '';
    if (file.type.includes('mp3')) return '';
    if (file.type.includes('ogg')) return '';
    if (file.type.includes('flac')) return '';
    return '';
  };

  // =================== RENDER ===================

  return (
    <div className="audio-file-browser" onClick={closeContextMenu}>
      {/* Header */}
      <div className="audio-file-browser__header">
        <h3 className="audio-file-browser__title">
          <FolderOpen size={16} />
          Audio Files
        </h3>

        <div className="audio-file-browser__controls">
          <button
            className={`audio-file-browser__view-toggle ${
              viewMode === 'grid' ? 'active' : ''
            }`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid size={14} />
          </button>

          <button
            className={`audio-file-browser__view-toggle ${
              viewMode === 'list' ? 'active' : ''
            }`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="audio-file-browser__search">
        <div className="audio-file-browser__search-input">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search audio files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Collections */}
      <div className="audio-file-browser__collections">
        {audioFileBrowser.collections.map(collection => (
          <button
            key={collection}
            className={`audio-file-browser__collection ${
              audioFileBrowser.activeCollection === collection ? 'active' : ''
            }`}
            onClick={() => setAudioFileCollection(collection.toLowerCase())}
          >
            <FolderOpen size={12} />
            {collection}
          </button>
        ))}
      </div>

      {/* Upload Area */}
      <div
        className="audio-file-browser__upload-area"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={20} />
        <span>Drop audio files here or click to upload</span>
        <small>Supports WAV, MP3, OGG, FLAC</small>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files.length > 0) {
            handleFileUpload(Array.from(e.target.files));
          }
        }}
      />

      {/* File List */}
      <div className={`audio-file-browser__files audio-file-browser__files--${viewMode}`}>
        {filteredFiles.length === 0 ? (
          <div className="audio-file-browser__empty">
            <FileAudio size={32} />
            <p>No audio files found</p>
            <small>Upload some audio files to get started</small>
          </div>
        ) : (
          filteredFiles.map(file => {
            const isPreviewPlaying = previewingFile === file.id;
            const isDragging = draggedFile?.id === file.id;

            return (
              <div
                key={file.id}
                className={`audio-file-browser__file ${
                  isDragging ? 'audio-file-browser__file--dragging' : ''
                }`}
                draggable
                onDragStart={(e) => handleFileDragStart(e, file)}
                onDragEnd={handleFileDragEnd}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {/* File Icon */}
                <div className="audio-file-browser__file-icon">
                  {getFileIcon(file)}
                </div>

                {/* File Info */}
                <div className="audio-file-browser__file-info">
                  <h4 className="audio-file-browser__file-name">
                    {file.name}
                  </h4>

                  <div className="audio-file-browser__file-meta">
                    <span className="audio-file-browser__file-duration">
                      <Clock size={10} />
                      {formatDuration(file.duration)}
                    </span>
                    <span className="audio-file-browser__file-size">
                      {formatFileSize(file.size)}
                    </span>
                    <span className="audio-file-browser__file-quality">
                      {file.sampleRate / 1000}kHz
                    </span>
                  </div>
                </div>

                {/* File Actions */}
                <div className="audio-file-browser__file-actions">
                  <button
                    className={`audio-file-browser__file-preview ${
                      isPreviewPlaying ? 'playing' : ''
                    }`}
                    onClick={() => handleFilePreview(file.id)}
                    title={isPreviewPlaying ? 'Stop Preview' : 'Preview Audio'}
                  >
                    {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>

                  <button
                    className="audio-file-browser__file-menu"
                    onClick={(e) => handleContextMenu(e, file)}
                    title="More Options"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {/* File Tags */}
                {file.tags && file.tags.length > 0 && (
                  <div className="audio-file-browser__file-tags">
                    {file.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="audio-file-browser__file-tag"
                      >
                        {tag}
                      </span>
                    ))}
                    {file.tags.length > 3 && (
                      <span className="audio-file-browser__file-tag-more">
                        +{file.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Waveform Preview */}
                <div className="audio-file-browser__file-waveform">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="audio-file-browser__waveform-bar"
                      style={{ height: `${Math.random() * 100}%` }}
                    />
                  ))}
                </div>

                {/* Drag Overlay */}
                {isDragging && (
                  <div className="audio-file-browser__file-drag-overlay">
                    <FileAudio size={24} />
                    <span>Drag to Arrangement</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="audio-file-browser__context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="audio-file-browser__context-item">
            <Play size={14} />
            Preview
          </button>

          <button className="audio-file-browser__context-item">
            <Music size={14} />
            Create Instrument
          </button>

          <button className="audio-file-browser__context-item">
            <Copy size={14} />
            Duplicate
          </button>

          <button className="audio-file-browser__context-item">
            <Edit3 size={14} />
            Rename
          </button>

          <button className="audio-file-browser__context-item">
            <Tag size={14} />
            Edit Tags
          </button>

          <div className="audio-file-browser__context-divider" />

          <button className="audio-file-browser__context-item">
            <Download size={14} />
            Export
          </button>

          <button className="audio-file-browser__context-item audio-file-browser__context-item--danger">
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="audio-file-browser__stats">
        <div className="audio-file-browser__stat">
          <span className="audio-file-browser__stat-label">Files:</span>
          <span className="audio-file-browser__stat-value">{filteredFiles.length}</span>
        </div>
        <div className="audio-file-browser__stat">
          <span className="audio-file-browser__stat-label">Total:</span>
          <span className="audio-file-browser__stat-value">
            {formatFileSize(filteredFiles.reduce((total, file) => total + file.size, 0))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioFileBrowser;
export { AudioFileBrowser };