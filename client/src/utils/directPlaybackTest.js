// Direct Playback Test - Bypass EVERYTHING, direct to speakers

export async function testDirectPlayback(audioEngine) {
    console.log('\n🧪 DIRECT PLAYBACK TEST - Bypassing entire chain\n');

    const audioContext = audioEngine.audioContext;
    const buffer = Array.from(audioEngine.sampleBuffers.values())[0];

    if (!buffer) {
        console.error('❌ No sample found');
        return;
    }

    console.log('📊 Sample Info:');
    console.log('  Channels:', buffer.numberOfChannels);
    console.log('  Sample Rate:', buffer.sampleRate);
    console.log('  Duration:', buffer.duration.toFixed(2) + 's');

    // Create source
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // OPTION 1: Direct to speakers (NO processing at all)
    console.log('\n🔊 Playing DIRECT to speakers (bypassing EVERYTHING)...');
    source.connect(audioContext.destination);
    source.start();

    console.log('✅ If this is CLEAN → Problem is in our audio chain');
    console.log('❌ If this is DISTORTED → Problem is sample file or browser');

    return new Promise(resolve => {
        source.onended = () => {
            console.log('✅ Playback finished');
            resolve();
        };
    });
}

// Make available globally
if (typeof window !== 'undefined') {
    window.testDirectPlayback = testDirectPlayback;
}
