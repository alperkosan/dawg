/**
 * Project Preview Player - Audio player for project previews in media panel
 * ✅ NEW: Uses AudioPreview component with direct CDN URL
 */

import React, { useMemo } from 'react';
import { AudioPreview } from '@/components/audio/AudioPreview';
import { apiClient } from '@/services/api.js';

export default function ProjectPreviewPlayer({
  audioUrl,
  duration,
  onPlayStateChange,
  className = '',
  title
}) {
  const resolvedUrl = useMemo(() => {
    if (!audioUrl) return '';
    const cleanUrl = audioUrl.replace(/[\n\r\t\s]+/g, '').trim();
    if (cleanUrl.startsWith('/api/')) {
      return `${apiClient.baseURL}${cleanUrl}`;
    }
    return cleanUrl;
  }, [audioUrl]);

  // ✅ NEW: Use AudioPreview component with CDN/absolute URL
  return (
    <AudioPreview
      url={resolvedUrl}
      title={title || 'Project Preview'}
      showAddButton={false}
      className={className}
    />
  );
}



