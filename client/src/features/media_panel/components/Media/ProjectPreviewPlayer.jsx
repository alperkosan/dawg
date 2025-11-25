/**
 * Project Preview Player - Audio player for project previews in media panel
 * ✅ NEW: Uses AudioPreview component with direct CDN URL
 */

import React, { useState, useEffect } from 'react';
import { AudioPreview } from '@/components/audio/AudioPreview';

export default function ProjectPreviewPlayer({
  audioUrl,
  duration,
  onPlayStateChange,
  className = '',
  title
}) {
  const [normalizedUrl, setNormalizedUrl] = useState(audioUrl);

  // ✅ FIX: Normalize URL to use backend proxy for CDN URLs (avoids CORS)
  useEffect(() => {
    let isMounted = true;

    const normalize = async () => {
      if (!audioUrl) return;

      let newUrl = audioUrl;

      // If it's a CDN URL (user-assets), convert to proxy endpoint
      if (audioUrl.includes('dawg.b-cdn.net/user-assets') || audioUrl.includes('user-assets/')) {
        // Extract assetId from URL pattern: .../user-assets/{userId}/{year-month}/{assetId}/{filename}
        const match = audioUrl.match(/user-assets\/[^/]+\/[^/]+\/([a-f0-9-]{36})\//);
        if (match && match[1]) {
          const assetId = match[1];
          // Dynamically import apiClient to avoid circular dependencies
          const { apiClient } = await import('@/services/api.js');
          newUrl = `${apiClient.baseURL}/assets/${assetId}/file`;
          console.log('ProjectPreviewPlayer: Using proxy endpoint:', newUrl);
        }
      }

      if (isMounted) {
        setNormalizedUrl(newUrl);
      }
    };

    normalize();

    return () => {
      isMounted = false;
    };
  }, [audioUrl]);

  // ✅ NEW: Use AudioPreview component with normalized URL (proxy if needed)
  return (
    <AudioPreview
      url={normalizedUrl}
      title={title || 'Project Preview'}
      showAddButton={false}
      className={className}
    />
  );
}



