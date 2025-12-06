
export const processAudioBuffer = (buffer, options = {}) => {
    if (!buffer) return buffer;

    // If no options set, return original
    const { reverse, normalize, reversePolarity } = options;
    if (!reverse && !normalize && !reversePolarity) {
        return buffer;
    }

    try {
        const clone = new AudioBuffer({
            length: buffer.length,
            numberOfChannels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate
        });

        let peak = 0;

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const source = buffer.getChannelData(channel);
            const target = clone.getChannelData(channel);
            const lastIndex = source.length - 1;

            if (reverse) {
                for (let i = 0; i < source.length; i++) {
                    let sample = source[i];
                    if (reversePolarity) sample = -sample;
                    const writeIndex = lastIndex - i;
                    target[writeIndex] = sample;
                    const abs = Math.abs(sample);
                    if (abs > peak) peak = abs;
                }
            } else {
                for (let i = 0; i < source.length; i++) {
                    let sample = source[i];
                    if (reversePolarity) sample = -sample;
                    target[i] = sample;
                    const abs = Math.abs(sample);
                    if (abs > peak) peak = abs;
                }
            }
        }

        if (normalize && peak > 0) {
            const gain = 1 / peak;
            for (let channel = 0; channel < clone.numberOfChannels; channel++) {
                const target = clone.getChannelData(channel);
                for (let i = 0; i < target.length; i++) {
                    target[i] *= gain;
                }
            }
        }

        return clone;
    } catch (error) {
        console.error('Buffer processing failed', error);
        return buffer;
    }
};
