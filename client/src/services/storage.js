/**
 * Lightweight client-side storage helper.
 * Matches the URL formatting logic on the server so the UI can build
 * the same CDN link without importing server-side modules.
 */

const sanitizePullZoneUrl = (url) => {
  if (!url) return '';
  return url
    .replace(/[\n\r\t\s]+/g, '') // Remove whitespace/newlines/tabs
    .replace(/\/+$/, '') // Trim trailing slashes
    .replace(/\/n\/?$/, '') // Remove accidental /n prefix
    .trim();
};

const getDefaultPullZoneUrl = () => {
  const envUrl = import.meta?.env?.VITE_BUNNY_PULL_ZONE_URL;
  if (envUrl && envUrl.length > 4) {
    return sanitizePullZoneUrl(envUrl);
  }
  // Last-resort default – matches production setup
  return 'https://dawg.b-cdn.net';
};

const cleanStorageKey = (storageKey) => {
  if (!storageKey) return '';
  return storageKey.replace(/^\/+/, '');
};

export const storageService = {
  /**
   * Generate a CDN URL for a given storage key.
   * @param {string} storageKey - Path inside Bunny storage zone.
   * @param {string} [assetId] - Optional asset id for API fallback.
   * @returns {string}
   */
  getCDNUrl(storageKey, assetId) {
    const pullZoneUrl = getDefaultPullZoneUrl();
    const key = cleanStorageKey(storageKey);

    if (pullZoneUrl && key) {
      return `${pullZoneUrl}/${key}`.replace(/[\n\r\t\s]+/g, '').trim();
    }

    // Fallback to API route when pull zone or key is missing
    const fallbackAssetId =
      assetId ||
      (() => {
        if (!key) return '';
        const parts = key.split('/');
        return parts.length >= 3 ? parts[2] : key;
      })();

    return fallbackAssetId ? `/api/assets/${fallbackAssetId}/file` : '';
  },
};

export default storageService;

