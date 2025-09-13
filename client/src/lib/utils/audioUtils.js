import * as Tone from 'tone';

/**
 * Bir Tone.ToneAudioBuffer'ın veya ham AudioBuffer'ın mükemmel ve bağımsız bir klonunu oluşturur.
 * Bu, tahribatsız (non-destructive) işlemler için hayati öneme sahiptir.
 * @param {Tone.ToneAudioBuffer | AudioBuffer} inputBuffer Klonlanacak buffer.
 * @returns {Tone.ToneAudioBuffer | null} Yeni, birebir aynı buffer örneği.
 */
export const cloneBuffer = (inputBuffer) => {
  if (!inputBuffer) return null;

  const nativeBuffer = inputBuffer instanceof Tone.ToneAudioBuffer 
    ? inputBuffer.get() 
    : inputBuffer;
  
  if (!nativeBuffer) return null;

  const newNativeBuffer = Tone.context.createBuffer(
    nativeBuffer.numberOfChannels,
    nativeBuffer.length,
    nativeBuffer.sampleRate
  );

  for (let c = 0; c < nativeBuffer.numberOfChannels; c++) {
    newNativeBuffer.getChannelData(c).set(nativeBuffer.getChannelData(c));
  }

  return new Tone.ToneAudioBuffer(newNativeBuffer);
};

/**
 * Bir ses arabelleğini (buffer) normalize eder. Orijinal veriyi değiştirmez.
 */
export const normalizeBuffer = (inputBuffer) => {
  const newNativeBuffer = Tone.context.createBuffer(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
    const originalData = inputBuffer.getChannelData(c);
    const newData = newNativeBuffer.getChannelData(c);
    let peak = 0;
    for (let i = 0; i < originalData.length; i++) {
      const absVal = Math.abs(originalData[i]);
      if (absVal > peak) peak = absVal;
    }
    if (peak > 0) {
      const gain = 1.0 / peak;
      for (let i = 0; i < originalData.length; i++) {
        newData[i] = originalData[i] * gain;
      }
    } else {
      newData.set(originalData);
    }
  }
  return new Tone.ToneAudioBuffer(newNativeBuffer);
};

/**
 * Bir ses arabelleğinin fazını ters çevirir.
 */
export const reversePolarity = (inputBuffer) => {
  const newNativeBuffer = Tone.context.createBuffer(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
    const originalData = inputBuffer.getChannelData(c);
    const newData = newNativeBuffer.getChannelData(c);
    for (let i = 0; i < originalData.length; i++) {
      newData[i] = originalData[i] * -1;
    }
  }
  return new Tone.ToneAudioBuffer(newNativeBuffer);
};

/**
 * Bir ses arabelleğindeki DC sapmasını kaldırır.
 */
export const removeDCOffset = (inputBuffer) => {
    const newNativeBuffer = Tone.context.createBuffer(
      inputBuffer.numberOfChannels,
      inputBuffer.length,
      inputBuffer.sampleRate
    );
    for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
        const originalData = inputBuffer.getChannelData(c);
        const newData = newNativeBuffer.getChannelData(c);
        let sum = 0;
        for (let i = 0; i < originalData.length; i++) sum += originalData[i];
        const offset = sum / originalData.length;
        if (offset !== 0) {
            for (let i = 0; i < originalData.length; i++) {
                newData[i] = originalData[i] - offset;
            }
        } else {
            newData.set(originalData);
        }
    }
    return new Tone.ToneAudioBuffer(newNativeBuffer);
};

/**
 * Bir ses arabelleğini ters çevirir.
 */
export const reverseBuffer = (inputBuffer) => {
  const newNativeBuffer = Tone.context.createBuffer(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
    const originalData = inputBuffer.getChannelData(c);
    const newData = newNativeBuffer.getChannelData(c);
    const len = originalData.length;
    for (let i = 0; i < len; i++) {
        newData[i] = originalData[len - 1 - i];
    }
  }
  return new Tone.ToneAudioBuffer(newNativeBuffer);
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

  if (slicedLength <= 0) return new Tone.ToneAudioBuffer(Tone.context.createBuffer(1, 1, inputBuffer.sampleRate));

  const slicedBuffer = Tone.context.createBuffer(
    inputBuffer.numberOfChannels,
    slicedLength,
    inputBuffer.sampleRate
  );

  for (let i = 0; i < inputBuffer.numberOfChannels; i++) {
    const channelData = inputBuffer.getChannelData(i);
    const slicedChannelData = slicedBuffer.getChannelData(i);
    slicedChannelData.set(channelData.subarray(startSample, endSample));
  }
  
  return new Tone.ToneAudioBuffer(slicedBuffer);
};
