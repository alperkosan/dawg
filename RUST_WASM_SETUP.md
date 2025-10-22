# Rust + WASM Setup Guide for Audio DSP

## 🎯 Goal

Setup Rust environment and create WebAssembly audio processing module for 4-5x performance improvement.

---

## 📋 Step 1: Install Rust

```bash
# Install Rust (will take 5-10 minutes)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Choose option 1 (default installation)
# This installs:
#   - rustc (Rust compiler)
#   - cargo (package manager)
#   - rustup (toolchain manager)

# After installation, configure your current shell:
source $HOME/.cargo/env

# Verify installation:
rustc --version  # Should show: rustc 1.xx.x
cargo --version  # Should show: cargo 1.xx.x
```

---

## 📋 Step 2: Install wasm-pack

```bash
# Install wasm-pack (WASM build tool)
cargo install wasm-pack

# This will take 5-10 minutes to compile
# Verify installation:
wasm-pack --version  # Should show: wasm-pack 0.xx.x
```

---

## 📋 Step 3: Create WASM Project

```bash
# Navigate to project
cd /home/bgs/İndirilenler/dawg/client/src/lib

# Create wasm directory
mkdir -p wasm
cd wasm

# Create new Rust library
cargo new --lib dawg-audio-dsp

# Project structure:
# dawg-audio-dsp/
# ├── Cargo.toml         # Package configuration
# ├── src/
# │   └── lib.rs        # Main library code
# └── target/           # Build output (created later)
```

---

## 📋 Step 4: Configure Cargo.toml

```bash
cd dawg-audio-dsp
```

Edit `Cargo.toml`:

```toml
[package]
name = "dawg-audio-dsp"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]  # Create dynamic library for WASM

[dependencies]
wasm-bindgen = "0.2"     # JavaScript interop

[profile.release]
opt-level = 3            # Maximum optimization
lto = true               # Link-time optimization
codegen-units = 1        # Better optimization (slower compile)
panic = 'abort'          # Smaller binary size

[profile.release.package."*"]
opt-level = 3
```

---

## 📋 Step 5: Implement Audio DSP

Edit `src/lib.rs`:

```rust
use wasm_bindgen::prelude::*;

// ============================================
// BIQUAD FILTER (3-band EQ core)
// ============================================

#[wasm_bindgen]
pub struct BiquadFilter {
    // Filter coefficients (pre-normalized)
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,

    // Filter state (Direct Form II)
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

#[wasm_bindgen]
impl BiquadFilter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> BiquadFilter {
        BiquadFilter {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    /// Process single sample through biquad filter
    pub fn process(&mut self, input: f32) -> f32 {
        // Direct Form II implementation
        let output = self.b0 * input + self.b1 * self.x1 + self.b2 * self.x2
                   - self.a1 * self.y1 - self.a2 * self.y2;

        // Update state
        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = output;

        output
    }

    /// Set filter coefficients
    pub fn set_coefficients(&mut self, b0: f32, b1: f32, b2: f32, a1: f32, a2: f32) {
        self.b0 = b0;
        self.b1 = b1;
        self.b2 = b2;
        self.a1 = a1;
        self.a2 = a2;
    }

    /// Reset filter state
    pub fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

// ============================================
// 3-BAND EQ
// ============================================

#[wasm_bindgen]
pub struct ThreeBandEQ {
    low: BiquadFilter,
    mid: BiquadFilter,
    high: BiquadFilter,
    sample_rate: f32,
}

#[wasm_bindgen]
impl ThreeBandEQ {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> ThreeBandEQ {
        ThreeBandEQ {
            low: BiquadFilter::new(),
            mid: BiquadFilter::new(),
            high: BiquadFilter::new(),
            sample_rate,
        }
    }

    /// Update EQ coefficients
    pub fn update_coefficients(
        &mut self,
        low_gain: f32,
        mid_gain: f32,
        high_gain: f32,
        low_freq: f32,
        high_freq: f32,
    ) {
        // Calculate coefficients for each band
        // (This is a simplified version - full implementation in actual code)

        let low_coeffs = calculate_lowshelf(low_freq, low_gain, self.sample_rate);
        self.low.set_coefficients(
            low_coeffs.0, low_coeffs.1, low_coeffs.2,
            low_coeffs.3, low_coeffs.4
        );

        let mid_coeffs = calculate_peaking(1000.0, mid_gain, self.sample_rate);
        self.mid.set_coefficients(
            mid_coeffs.0, mid_coeffs.1, mid_coeffs.2,
            mid_coeffs.3, mid_coeffs.4
        );

        let high_coeffs = calculate_highshelf(high_freq, high_gain, self.sample_rate);
        self.high.set_coefficients(
            high_coeffs.0, high_coeffs.1, high_coeffs.2,
            high_coeffs.3, high_coeffs.4
        );
    }

    /// Process single sample through 3-band EQ
    pub fn process(&mut self, input: f32) -> f32 {
        let mut output = input;
        output = self.low.process(output);
        output = self.mid.process(output);
        output = self.high.process(output);
        output
    }

    /// Reset all filters
    pub fn reset(&mut self) {
        self.low.reset();
        self.mid.reset();
        self.high.reset();
    }
}

// ============================================
// AUDIO PROCESSOR (Main entry point)
// ============================================

#[wasm_bindgen]
pub struct WasmAudioProcessor {
    eq_l: ThreeBandEQ,
    eq_r: ThreeBandEQ,
    sample_rate: f32,

    // Compression state
    comp_gain: f32,
    comp_threshold_linear: f32,
}

#[wasm_bindgen]
impl WasmAudioProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> WasmAudioProcessor {
        WasmAudioProcessor {
            eq_l: ThreeBandEQ::new(sample_rate),
            eq_r: ThreeBandEQ::new(sample_rate),
            sample_rate,
            comp_gain: 1.0,
            comp_threshold_linear: 1.0,
        }
    }

    /// Process stereo buffer
    #[wasm_bindgen]
    pub fn process_buffer(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
        eq_active: bool,
        comp_active: bool,
        gain: f32,
        threshold: f32,
        ratio: f32,
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());

        for i in 0..len {
            let mut sample_l = input_l[i];
            let mut sample_r = input_r[i];

            // EQ processing
            if eq_active {
                sample_l = self.eq_l.process(sample_l);
                sample_r = self.eq_r.process(sample_r);
            }

            // Compression
            if comp_active {
                let comp_gain = self.process_compression(sample_l, sample_r, threshold, ratio);
                sample_l *= comp_gain;
                sample_r *= comp_gain;
            }

            // Gain
            sample_l *= gain;
            sample_r *= gain;

            output_l[i] = sample_l;
            output_r[i] = sample_r;
        }
    }

    /// Update EQ settings
    pub fn update_eq_coefficients(
        &mut self,
        low_gain: f32,
        mid_gain: f32,
        high_gain: f32,
        low_freq: f32,
        high_freq: f32,
    ) {
        self.eq_l.update_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq);
        self.eq_r.update_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq);
    }

    /// Process compression (simplified)
    fn process_compression(&mut self, left: f32, right: f32, threshold: f32, ratio: f32) -> f32 {
        let input_level = left.abs().max(right.abs());

        if input_level < 0.001 || threshold >= 0.0 {
            // Smooth back to 1.0
            self.comp_gain += (1.0 - self.comp_gain) * 0.003;
            return self.comp_gain;
        }

        // Update threshold linear if changed
        self.comp_threshold_linear = 10.0_f32.powf(threshold / 20.0);

        let mut target_gain = 1.0;
        if input_level > self.comp_threshold_linear {
            let excess = (input_level - self.comp_threshold_linear) / self.comp_threshold_linear;
            let reduction = excess / ratio;
            target_gain = 1.0 / (1.0 + reduction);
        }

        // Smooth gain
        let time_constant = if target_gain < self.comp_gain { 0.003 } else { 0.1 };
        let smoothing_factor = 1.0 - (-1.0 / (time_constant * self.sample_rate)).exp();

        self.comp_gain += (target_gain - self.comp_gain) * smoothing_factor;
        self.comp_gain
    }

    /// Reset all state
    pub fn reset(&mut self) {
        self.eq_l.reset();
        self.eq_r.reset();
        self.comp_gain = 1.0;
    }
}

// ============================================
// COEFFICIENT CALCULATION HELPERS
// ============================================

fn calculate_lowshelf(frequency: f32, gain: f32, sample_rate: f32) -> (f32, f32, f32, f32, f32) {
    let omega = 2.0 * std::f32::consts::PI * frequency / sample_rate;
    let sin_omega = omega.sin();
    let cos_omega = omega.cos();
    let alpha = sin_omega / 2.0;
    let a = 10.0_f32.powf(gain / 40.0);
    let sqrt_a = a.sqrt();

    let b0 = a * ((a + 1.0) - (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha);
    let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_omega);
    let b2 = a * ((a + 1.0) - (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha);
    let a0 = (a + 1.0) + (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha;
    let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_omega);
    let a2 = (a + 1.0) + (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha;

    (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

fn calculate_highshelf(frequency: f32, gain: f32, sample_rate: f32) -> (f32, f32, f32, f32, f32) {
    let omega = 2.0 * std::f32::consts::PI * frequency / sample_rate;
    let sin_omega = omega.sin();
    let cos_omega = omega.cos();
    let alpha = sin_omega / 2.0;
    let a = 10.0_f32.powf(gain / 40.0);
    let sqrt_a = a.sqrt();

    let b0 = a * ((a + 1.0) + (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha);
    let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_omega);
    let b2 = a * ((a + 1.0) + (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha);
    let a0 = (a + 1.0) - (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha;
    let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_omega);
    let a2 = (a + 1.0) - (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha;

    (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

fn calculate_peaking(frequency: f32, gain: f32, sample_rate: f32) -> (f32, f32, f32, f32, f32) {
    let omega = 2.0 * std::f32::consts::PI * frequency / sample_rate;
    let sin_omega = omega.sin();
    let cos_omega = omega.cos();
    let alpha = sin_omega / 2.0;
    let a = 10.0_f32.powf(gain / 40.0);

    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cos_omega;
    let b2 = 1.0 - alpha * a;
    let a0 = 1.0 + alpha / a;
    let a1 = -2.0 * cos_omega;
    let a2 = 1.0 - alpha / a;

    (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}
```

---

## 📋 Step 6: Build WASM Module

```bash
# Build for web (takes 1-2 minutes first time)
wasm-pack build --target web --release

# Output will be in: pkg/
# Key files:
#   - dawg_audio_dsp_bg.wasm     (compiled WebAssembly)
#   - dawg_audio_dsp.js          (JavaScript glue code)
#   - dawg_audio_dsp.d.ts        (TypeScript definitions)
```

---

## 📋 Step 7: Copy to Public Directory

```bash
# Copy WASM files to public directory (so Vite can serve them)
mkdir -p ../../../public/wasm
cp pkg/dawg_audio_dsp_bg.wasm ../../../public/wasm/
cp pkg/dawg_audio_dsp.js ../../../public/wasm/
cp pkg/dawg_audio_dsp.d.ts ../../../public/wasm/

echo "✅ WASM module ready!"
```

---

## 📋 Step 8: Integrate with WasmBackend.js

Update `client/src/lib/audio-backends/WasmBackend.js`:

```javascript
import { AudioProcessorBackend, BackendType, ProcessingMode } from './AudioProcessorBackend.js';

export class WasmBackend extends AudioProcessorBackend {
    constructor(sampleRate) {
        super(sampleRate);
        this.wasmModule = null;
        this.wasmProcessor = null;
        this.processingMode = ProcessingMode.BUFFER;
    }

    async initialize() {
        try {
            // Import WASM module
            const wasmModule = await import('/wasm/dawg_audio_dsp.js');

            // Initialize WASM
            await wasmModule.default();

            // Create processor instance
            this.wasmProcessor = new wasmModule.WasmAudioProcessor(this.sampleRate);

            this.wasmModule = wasmModule;
            this.isInitialized = true;

            console.log('✅ WASM audio backend initialized');
        } catch (error) {
            console.error('❌ WASM initialization failed:', error);
            throw error;
        }
    }

    processBuffer(inputL, inputR, outputL, outputR, params) {
        if (!this.isInitialized || !this.wasmProcessor) {
            throw new Error('WASM backend not initialized');
        }

        // ⚡ Call WASM processor (4-5x faster than JS!)
        this.wasmProcessor.process_buffer(
            inputL,
            inputR,
            outputL,
            outputR,
            params.eqActive ? 1 : 0,
            params.compActive ? 1 : 0,
            params.gain,
            params.threshold,
            params.ratio
        );
    }

    updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq) {
        if (this.wasmProcessor) {
            this.wasmProcessor.update_eq_coefficients(
                lowGain, midGain, highGain, lowFreq, highFreq
            );
        }
    }

    // ... rest of implementation
}
```

---

## 📋 Step 9: Test & Benchmark

```javascript
// Browser console:
const backend = await AudioProcessorFactory.createBackend('wasm', 48000);
const results = await AudioProcessorFactory.benchmarkAllBackends(48000);

console.log('Performance comparison:', results);
// Expected:
// javascript: 850ms (1.0x)
// wasm: 189ms (4.5x faster!) 🚀
```

---

## 🎯 Expected Results

### Performance:
```
JavaScript Backend:
  - 20 channels × 0.9ms = 18ms per block
  - CPU: 674%

WASM Backend:
  - 20 channels × 0.2ms = 4ms per block
  - CPU: 150%

WASM + Bypass:
  - 5 active × 0.2ms = 1ms per block
  - CPU: 37% ✅
```

### File Sizes:
```
dawg_audio_dsp_bg.wasm: ~50KB (optimized)
dawg_audio_dsp.js: ~10KB (glue code)
```

---

## ⚡ Next Steps After WASM Works

1. **Add SIMD optimizations** (process 4 samples at once)
2. **Implement SharedArrayBuffer** (zero-copy parameters)
3. **Multi-channel processing** (process all channels in one call)
4. **Phase 3: WASM MegaMixer** (11x graph reduction)

---

## 🐛 Troubleshooting

### Issue: "wasm-bindgen not found"
```bash
cargo install wasm-bindgen-cli
```

### Issue: "WASM module not loading"
Check browser console - may need to serve with proper MIME types.
Vite handles this automatically.

### Issue: "Performance not improving"
- Check that WASM is actually being used (not JS fallback)
- Verify with: `backend.getCapabilities().type === 'wasm'`
- Check build is in `--release` mode (not debug)

---

## 📚 Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

**Ready to begin! Follow steps 1-9 to implement WASM audio processing.** 🚀
