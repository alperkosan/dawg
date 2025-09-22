// client/src/lib/utils/audioUtils.js - Native Version
// DAWG - Native Audio Utilities - ToneJS'siz implementasyon

/**
 * Native AudioContext tabanlı audio utility fonksiyonları
 * ToneJS bağımlılığı tamamen kaldırıldı
 */

// Global AudioContext referansı (NativeAudioEngine'den alınacak)
let globalAudioContext = null;

export const setGlobalAudioContext = (audioContext) => {
    globalAudioContext = audioContext;
};

export const getGlobalAudioContext = () => {
    return globalAudioContext || new (window.AudioContext || window.webkitAudioContext)();
};

/**
 * Bir AudioBuffer'ın mükemmel ve bağımsız bir klonunu oluşturur.
 * Bu, tahribatsız (non-destructive) işlemler için hayati öneme sahiptir.
 * @param {AudioBuffer} inputBuffer Klonlanacak buffer.
 * @returns {AudioBuffer | null} Yeni, birebir aynı buffer örneği.
 */
export const cloneBuffer = (inputBuffer) => {
    if (!inputBuffer) return null;

    const audioContext = getGlobalAudioContext();

    const newBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
    );

    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const channelData = new Float32Array(inputBuffer.getChannelData(c));
        newBuffer.getChannelData(c).set(channelData);
    }

    return newBuffer;
};

/**
 * Bir ses arabelleğini (buffer) normalize eder. Orijinal veriyi değiştirmez.
 */
export const normalizeBuffer = (inputBuffer) => {
    if (!inputBuffer) return null;

    const audioContext = getGlobalAudioContext();

    const newBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
    );

    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const originalData = inputBuffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);

        // Peak değerini bul
        let peak = 0;
        for (let i = 0; i < originalData.length; i++) {
            const absVal = Math.abs(originalData[i]);
            if (absVal > peak) peak = absVal;
        }

        // Normalize et
        if (peak > 0) {
            const gain = 1.0 / peak;
            for (let i = 0; i < originalData.length; i++) {
                newData[i] = originalData[i] * gain;
            }
        } else {
            newData.set(originalData);
        }
    }

    return newBuffer;
};

/**
 * Bir ses arabelleğinin fazını ters çevirir.
 */
export const reversePolarity = (inputBuffer) => {
    if (!inputBuffer) return null;

    const audioContext = getGlobalAudioContext();

    const newBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
    );

    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const originalData = inputBuffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);

        for (let i = 0; i < originalData.length; i++) {
            newData[i] = originalData[i] * -1;
        }
    }

    return newBuffer;
};

/**
 * Bir ses arabelleğindeki DC sapmasını kaldırır.
 */
export const removeDCOffset = (inputBuffer) => {
    if (!inputBuffer) return null;

    const audioContext = getGlobalAudioContext();

    const newBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
    );

    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const originalData = inputBuffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);

        // DC offset hesapla
        let sum = 0;
        for (let i = 0; i < originalData.length; i++) {
            sum += originalData[i];
        }
        const offset = sum / originalData.length;

        // DC offset'i kaldır
        if (offset !== 0) {
            for (let i = 0; i < originalData.length; i++) {
                newData[i] = originalData[i] - offset;
            }
        } else {
            newData.set(originalData);
        }
    }

    return newBuffer;
};

/**
 * Bir ses arabelleğini ters çevirir.
 */
export const reverseBuffer = (inputBuffer) => {
    if (!inputBuffer) return null;

    const audioContext = getGlobalAudioContext();

    const newBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
    );

    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const originalData = inputBuffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);
        const len = originalData.length;

        for (let i = 0; i < len; i++) {
            newData[i] = originalData[len - 1 - i];
        }
    }

    return newBuffer;
};

/**
 * Bir ses arabelleğini verilen yüzdelere göre keser.
 */
export const sliceBuffer = (inputBuffer, startPercentage = 0, lengthPercentage = 1) => {
    if (!inputBuffer) return null;

    const startSample = Math.floor(inputBuffer.length * startPercentage);
    let endSample = startSample + Math.floor(inputBuffer.length * lengthPercentage);
    endSample = Math.min(endSample, inputBuffer.length);
    const slicedLength = endSample - startSample;

    if (slicedLength <= 0) {
        const audioContext = getGlobalAudioContext();
        return audioContext.createBuffer(1, 1, inputBuffer.sampleRate);
    }

    const audioContext = getGlobalAudioContext();
    const slicedBuffer = audioContext.createBuffer(
        inputBuffer.numberOfChannels,
        slicedLength,
        inputBuffer.sampleRate
    );

    for (let i = 0; i < inputBuffer.numberOfChannels; i++) {
        const channelData = inputBuffer.getChannelData(i);
        const slicedChannelData = slicedBuffer.getChannelData(i);
        slicedChannelData.set(channelData.subarray(startSample, endSample));
    }

    return slicedBuffer;
};

/**
 * Native AudioParam için yumuşak parametre değiştirme
 * @param {AudioParam} param - Değiştirilecek audio parametresi
 * @param {number} value - Hedef değer
 * @param {number} rampTime - Yumuşak geçişin saniye cinsinden süresi
 */
export const setParamSmoothly = (param, value, rampTime = 0.02) => {
    if (!param || typeof param.setTargetAtTime !== 'function') return;

    const audioContext = getGlobalAudioContext();
    const currentTime = audioContext.currentTime;

    try {
        // Cancel any pending parameter changes
        param.cancelScheduledValues(currentTime);

        // Use exponential ramp for smooth transitions
        if (value > 0) {
            param.exponentialRampToValueAtTime(value, currentTime + rampTime);
        } else {
            // For zero values, use linear ramp
            param.linearRampToValueAtTime(value, currentTime + rampTime);
        }
    } catch (error) {
        // Fallback to immediate value setting
        param.value = value;
    }
};

/**
 * Sidechain yönlendirmesi için gerekli Web Audio düğümlerini oluşturur.
 * @param {AudioContext} audioContext - Native audio context
 * @returns {{splitter: ChannelSplitterNode, merger: ChannelMergerNode, sidechainGain: GainNode}}
 */
export const createSidechainRouter = (audioContext) => {
    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(2);
    const sidechainGain = audioContext.createGain();

    return { splitter, merger, sidechainGain };
};

/**
 * Spektrum analizi için bir AnalyserNode oluşturur.
 * @param {AudioContext} audioContext - Native audio context
 * @param {number} fftSize - FFT (Hızlı Fourier Dönüşümü) boyutu
 * @returns {AnalyserNode}
 */
export const createAnalyzer = (audioContext, fftSize = 2048) => {
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = fftSize;
    analyzer.smoothingTimeConstant = 0.8;
    return analyzer;
};

/**
 * AudioBuffer'dan peak değerleri hesapla
 */
export const calculatePeaks = (buffer, numPeaks = 1000) => {
    if (!buffer) return [];

    const channelData = buffer.getChannelData(0); // Mono için ilk kanalı al
    const samplesPerPeak = Math.floor(channelData.length / numPeaks);
    const peaks = [];

    for (let i = 0; i < numPeaks; i++) {
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, channelData.length);

        let peak = 0;
        for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > peak) peak = abs;
        }

        peaks.push(peak);
    }

    return peaks;
};

/**
 * Native context'ten buffer decode etme
 */
export const decodeAudioData = async (arrayBuffer) => {
    const audioContext = getGlobalAudioContext();

    try {
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error('Audio decoding failed:', error);
        throw error;
    }
};

/**
 * Buffer'ı frequency domain'e çevirme (basit FFT analizi)
 */
export const analyzeFrequencyContent = (buffer) => {
    if (!buffer) return null;

    const audioContext = getGlobalAudioContext();

    // Analyzer node oluştur
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 2048;

    // Buffer source oluştur
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(analyzer);

    // Frequency data al
    const frequencyData = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(frequencyData);

    return frequencyData;
};

// Export default object for backward compatibility
export default {
    setGlobalAudioContext,
    getGlobalAudioContext,
    cloneBuffer,
    normalizeBuffer,
    reversePolarity,
    removeDCOffset,
    reverseBuffer,
    sliceBuffer,
    setParamSmoothly,
    createSidechainRouter,
    createAnalyzer,
    calculatePeaks,
    decodeAudioData,
    analyzeFrequencyContent
};