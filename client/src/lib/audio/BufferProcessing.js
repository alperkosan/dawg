import * as Tone from 'tone';

export class BufferProcessor {
  // Fade In işlemi
  static async fadeIn(buffer, fadeTimeMs = 100) {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = buffer.get ? buffer.get() : buffer;

    const gainNode = offlineContext.createGain();
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(1, fadeTimeMs / 1000);

    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    source.start(0);

    const processedBuffer = await offlineContext.startRendering();
    return new Tone.ToneAudioBuffer(processedBuffer);
  }

  // Fade Out işlemi
  static async fadeOut(buffer, fadeTimeMs = 100) {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = buffer.get ? buffer.get() : buffer;

    const gainNode = offlineContext.createGain();
    const fadeStartTime = buffer.duration - (fadeTimeMs / 1000);
    
    if (fadeStartTime > 0) {
      gainNode.gain.setValueAtTime(1, 0);
      gainNode.gain.setValueAtTime(1, fadeStartTime);
      gainNode.gain.linearRampToValueAtTime(0, buffer.duration);
    }

    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    source.start(0);

    const processedBuffer = await offlineContext.startRendering();
    return new Tone.ToneAudioBuffer(processedBuffer);
  }

  // Gain işlemi
  static async applyGain(buffer, gainDb) {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = buffer.get ? buffer.get() : buffer;

    const gainNode = offlineContext.createGain();
    gainNode.gain.value = Math.pow(10, gainDb / 20);

    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    source.start(0);

    const processedBuffer = await offlineContext.startRendering();
    return new Tone.ToneAudioBuffer(processedBuffer);
  }
}