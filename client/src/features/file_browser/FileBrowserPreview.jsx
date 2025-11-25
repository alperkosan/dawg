import React, { useCallback } from 'react';
import { AudioPreview } from '@/components/audio/AudioPreview';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name } = fileNode || {};
  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

  const handleAddToProject = useCallback(() => {
    if (fileNode?.type === 'file') {
      handleAddNewInstrument({ name: fileNode.name, url: fileNode.url });
    }
  }, [fileNode, handleAddNewInstrument]);

  // Empty state
  if (!fileNode || fileNode.type !== 'file') {
    return (
      <div className="preview">
        <div className="preview__info">Select a file to preview</div>
        <div className="preview__content">
          <div className="preview__status"></div>
        </div>
      </div>
    );
  }

  // ✅ NEW: Use AudioPreview component with direct CDN URL
  // CDN URL should be stored in fileNode.url (full CDN URL from storage_url)
  return (
    <div className="preview">
      <AudioPreview
        url={url}
        title={name}
        onAddToProject={handleAddToProject}
        showAddButton={true}
        className="preview__audio"
        variant="compact"
      />
    </div>
  );
}

