import { useState, useCallback } from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

export const useSampleDrop = () => {
    const [isNativeDragOver, setIsNativeDragOver] = useState(false);
    const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

    const handleNativeDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNativeDragOver(true);
    }, []);

    const handleNativeDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNativeDragOver(true);
    }, []);

    const handleNativeDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
            setIsNativeDragOver(false);
        }
    }, []);

    const handleNativeDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNativeDragOver(false);

        try {
            const data = e.dataTransfer.getData('text/plain');
            if (data) {
                const fileData = JSON.parse(data);
                console.log('🎵 Native drag sample dropped:', fileData);

                // Load dependencies dynamically
                const { AudioContextService } = await import('@/lib/services/AudioContextService');
                const { getProjectBufferManager } = await import('@/lib/audio/ProjectBufferManager.js');

                const audioEngine = AudioContextService.getAudioEngine();
                if (!audioEngine?.audioContext) {
                    console.warn('⚠️ Audio Engine not ready for sample drop');
                    return;
                }

                try {
                    const bufferManager = getProjectBufferManager();
                    const audioBuffer = await bufferManager.getBuffer(fileData.url, audioEngine.audioContext);

                    console.log('✅ Audio buffer loaded:', audioBuffer.duration, 'seconds');

                    handleAddNewInstrument({
                        name: fileData.name,
                        url: fileData.url,
                        audioBuffer: audioBuffer,
                        type: 'sample'
                    });
                } catch (loadError) {
                    console.error('Failed to load audio file:', loadError);
                    // Toast notification handling could be injected or imported if needed
                    // For now, logging error is sufficient as per original code, 
                    // though original code imported apiClient for toast.
                    const { apiClient } = await import('@/services/api.js');
                    apiClient.showToast(`Failed to load audio file: ${fileData.name}`, 'error', 5000);
                }
            }
        } catch (error) {
            console.error('Failed to handle native drop:', error);
        }
    }, [handleAddNewInstrument]);

    return {
        isNativeDragOver,
        handleNativeDragOver,
        handleNativeDragEnter,
        handleNativeDragLeave,
        handleNativeDrop
    };
};
