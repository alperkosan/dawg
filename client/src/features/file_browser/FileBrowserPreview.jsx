import React from 'react';
import WaveformDisplay from '../sample_editor/WaveformDisplay';
import { Loader2, Play, Pause } from 'lucide-react';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name } = fileNode || {};

  // --- NİHAİ ÇÖZÜM: Atomik Seçim ---
  // Store'dan ihtiyacımız olan her bir veriyi ayrı ayrı seçiyoruz.
  // Bu yöntem, gereksiz obje oluşturmayı ve referans hatalarını %100 engeller.
  const isPlaying = usePreviewPlayerStore(state => state.isPlaying);
  const playingUrl = usePreviewPlayerStore(state => state.playingUrl);
  const loadingUrl = usePreviewPlayerStore(state => state.loadingUrl);
  const waveformBuffer = usePreviewPlayerStore(state => state.waveformBuffer);
  const error = usePreviewPlayerStore(state => state.error);

  // Eylemi `getState` ile alıyoruz, çünkü bu fonksiyon değişmez ve render tetiklemez.
  const { playPreview } = usePreviewPlayerStore.getState();

  if (!fileNode || fileNode.type !== 'file') {
    return null;
  }

  const isCurrentlyPlaying = isPlaying && playingUrl === url;
  const isLoading = loadingUrl === url;

  const handlePreviewToggle = () => {
    playPreview(url);
  };

  return (
    <div className="w-full h-28 bg-gray-900/50 rounded-lg p-2 flex flex-col justify-center items-center shrink-0 relative">
      {!isLoading && !error && (
        <button
          onClick={handlePreviewToggle}
          className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 transition-colors duration-200"
          title={isCurrentlyPlaying ? "Durdur" : "Çal"}
        >
          {isCurrentlyPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
      )}

      <div className="w-full h-full relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500">
            {error}
          </div>
        )}
        {/* Dalga formunu sadece seçili dosya bizimki ise göster */}
        {waveformBuffer && url === usePreviewPlayerStore.getState().loadingUrl && !error && (
          <WaveformDisplay
            buffer={waveformBuffer}
            className="w-full h-full opacity-50"
          />
        )}
         {waveformBuffer && !isLoading && !error && (
            <WaveformDisplay
                buffer={waveformBuffer}
                className="w-full h-full opacity-50"
            />
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1 truncate w-full text-center">{name}</p>
    </div>
  );
}

