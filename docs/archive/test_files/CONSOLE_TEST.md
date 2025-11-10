# 🧪 Console Test - Direct Playback

Browser console'a aşağıdaki kodu yapıştır ve çalıştır:

## Test 1: Sample Rate Check

```javascript
console.log('📊 SAMPLE RATE CHECK:');
console.log('AudioContext sample rate:', audioEngine.audioContext.sampleRate);

const buffer = Array.from(audioEngine.sampleBuffers.values())[0];
console.log('Sample buffer sample rate:', buffer.sampleRate);

if (audioEngine.audioContext.sampleRate !== buffer.sampleRate) {
    console.error('🔥 SAMPLE RATE MISMATCH!');
    console.error('   AudioContext:', audioEngine.audioContext.sampleRate);
    console.error('   Sample:', buffer.sampleRate);
    console.error('   → Browser is resampling → Potential distortion!');
} else {
    console.log('✅ Sample rates match');
}
```

## Test 2: Direct Playback (Bypass Everything)

```javascript
console.log('\n🧪 DIRECT PLAYBACK TEST\n');

const ctx = audioEngine.audioContext;
const buffer = Array.from(audioEngine.sampleBuffers.values())[0];

// Create source
const source = ctx.createBufferSource();
source.buffer = buffer;

// Create gain for control
const testGain = ctx.createGain();
testGain.gain.value = 0.1; // Low volume for safety

// Connect: source → gain → speakers (BYPASS EVERYTHING ELSE)
source.connect(testGain);
testGain.connect(ctx.destination);

console.log('🔊 Playing sample DIRECTLY to speakers...');
console.log('   Bypassing: UnifiedMixer, WASM, Master Chain, EVERYTHING!');
source.start();

source.onended = () => {
    console.log('✅ Playback finished');
    console.log('\nRESULT:');
    console.log('  If CLEAN → Problem is in our audio chain');
    console.log('  If DISTORTED → Problem is sample file or browser/driver');
};
```

## Test 3: Check for Clipping in Sample Data

```javascript
console.log('\n📊 SAMPLE DATA ANALYSIS\n');

const buffer = Array.from(audioEngine.sampleBuffers.values())[0];
const data = buffer.getChannelData(0);

let peak = 0;
let sum = 0;
let clipped = 0;

for (let i = 0; i < data.length; i++) {
    const val = Math.abs(data[i]);
    peak = Math.max(peak, val);
    sum += data[i] * data[i];
    if (val > 0.99) clipped++;
}

const rms = Math.sqrt(sum / data.length);
const crestFactor = peak / rms;

console.log('Peak:', (peak * 100).toFixed(1) + '%', '→', (20 * Math.log10(peak)).toFixed(2) + ' dBFS');
console.log('RMS:', (rms * 100).toFixed(1) + '%', '→', (20 * Math.log10(rms)).toFixed(2) + ' dBFS');
console.log('Crest Factor:', crestFactor.toFixed(2));
console.log('Clipped samples:', clipped, '/', data.length, '(' + (clipped / data.length * 100).toFixed(3) + '%)');

if (peak > 0.99) {
    console.error('🔥 SAMPLE NEAR CLIPPING! Peak:', (peak * 100).toFixed(1) + '%');
}
if (crestFactor < 3) {
    console.warn('⚠️ LOW CREST FACTOR - Sample may be over-compressed');
}
if (clipped > 0) {
    console.error('🔥 SAMPLE CONTAINS CLIPPED DATA!');
}
```

---

## Sonuçları Yorumla:

### Senaryo 1: Sample Rate Mismatch
```
AudioContext: 48000 Hz
Sample: 44100 Hz
→ Browser resampling yapıyor → Distortion!
```
**Çözüm:** AudioContext'i sample rate'e eşitle veya sample'ı resample et

### Senaryo 2: Direct Playback Temiz
```
Direct playback → CLEAN ✅
Normal playback → DISTORTED ❌
```
**Çözüm:** Problem audio chain'de, UnifiedMixer veya başka bir yerde

### Senaryo 3: Direct Playback Distorted
```
Direct playback → DISTORTED ❌
```
**Çözüm:** Sample dosyası veya browser/driver problemi

### Senaryo 4: Sample Data Clipping
```
Peak > 99% veya Clipped samples > 0
```
**Çözüm:** Sample dosyası zaten clipping yapıyor

---

## ÖNCE BU TESTLERİ YAP!

Sonuçları söyle, ona göre devam edelim!
