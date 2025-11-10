# 🔧 WASM Rust Code Fixes - Applied

**Date:** 2025-10-22
**Status:** Code Fixed - Rebuild Required
**Files Modified:** [client/src/lib/wasm/dawg-audio-dsp/src/lib.rs](client/src/lib/wasm/dawg-audio-dsp/src/lib.rs)

---

## 🐛 Bugs Fixed

### Bug 1: Pan Formula Causing -3dB Loss at Center ✅

**Location:** `lib.rs` lines 383-392
**Problem:** Center pan (0.0) was applying 0.707x gain to both channels = -3dB loss!

**OLD CODE (WRONG):**
```rust
// Lines 384-389
let pan_rad = (self.pan + 1.0) * 0.5 * std::f32::consts::FRAC_PI_2; // 0 to PI/2
let left_gain = pan_rad.cos();   // pan=0 → 0.707 (-3dB!)
let right_gain = pan_rad.sin();  // pan=0 → 0.707 (-3dB!)

out_l *= left_gain;
out_r *= right_gain;
```

**NEW CODE (FIXED):**
```rust
// Lines 389-408
// Panning (linear law - unity gain at center for RAW signal)
// pan = -1.0 (full left)  → left=1.0, right=0.0
// pan =  0.0 (center)     → left=1.0, right=1.0 (UNITY GAIN - no loss!)
// pan = +1.0 (full right) → left=0.0, right=1.0
//
// Using linear panning law (not constant power) for RAW signal philosophy
let left_gain = if self.pan <= 0.0 {
    1.0
} else {
    1.0 - self.pan
};

let right_gain = if self.pan >= 0.0 {
    1.0
} else {
    1.0 + self.pan
};

out_l *= left_gain;
out_r *= right_gain;
```

**Impact:** Every channel was losing 3dB at center pan! This was likely causing the piano distortion.

---

### Bug 2: Hardcoded Compression Parameters ✅

**Location:** `lib.rs` lines 510-523
**Problem:** Compression threshold and ratio were hardcoded (-10.0 dB, 4:1), ignoring JavaScript parameters!

**OLD CODE (WRONG):**
```rust
// Lines 513-514
let (out_l, out_r) = channel.process(
    in_l,
    in_r,
    -10.0,  // ← HARDCODED threshold!
    4.0,    // ← HARDCODED ratio!
    self.sample_rate
);
```

**NEW CODE (FIXED):**
```rust
// Added to ChannelStrip struct (lines 339-341):
comp_threshold: f32,  // in dB
comp_ratio: f32,

// Constructor defaults (lines 357-358):
comp_threshold: -12.0,  // Default: -12dB
comp_ratio: 4.0,        // Default: 4:1

// Process method now uses stored params (line 380):
let comp_gain = self.process_compression(out_l, out_r, self.comp_threshold, self.comp_ratio, sample_rate);

// process_mix simplified (lines 519-522):
let (out_l, out_r) = channel.process(
    in_l,
    in_r,
    self.sample_rate  // No more hardcoded params!
);

// NEW PUBLIC API (lines 583-596):
#[wasm_bindgen]
pub fn set_channel_compression(
    &mut self,
    channel_idx: usize,
    threshold: f32,
    ratio: f32,
) {
    if channel_idx < self.channels.len() {
        let channel = &mut self.channels[channel_idx];
        channel.comp_threshold = threshold;
        channel.comp_ratio = ratio;
    }
}
```

**Impact:** Compression is now configurable from JavaScript!

---

## 📝 Summary of Changes

### Files Modified
1. **`/Users/alperkosan/dawg/client/src/lib/wasm/dawg-audio-dsp/src/lib.rs`**
   - Fixed pan formula (lines 383-392)
   - Added `comp_threshold` and `comp_ratio` fields to `ChannelStrip` struct (lines 339-341)
   - Updated constructor with default compression values (lines 357-358)
   - Modified `process()` method signature to use stored compression params (line 364)
   - Updated `process()` method to use `self.comp_threshold` and `self.comp_ratio` (line 380)
   - Simplified `process_mix()` call (lines 519-522)
   - Added new public API method `set_channel_compression()` (lines 583-596)

### Lines Changed
- **Line 364:** Function signature changed
- **Lines 380-382:** Compression now uses stored parameters
- **Lines 383-392:** Pan formula corrected
- **Lines 339-341:** New struct fields added
- **Lines 357-358:** Constructor updated
- **Lines 519-522:** process_mix call simplified
- **Lines 583-596:** New API method added

---

## 🔨 Rebuild Instructions

### Prerequisites
You need Rust and wasm-pack installed. If not installed:

```bash
# 1. Install Rust (takes 5-10 minutes)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Choose option 1 (default installation)

# Configure current shell
source $HOME/.cargo/env

# Verify
rustc --version
cargo --version

# 2. Install wasm-pack (takes 5-10 minutes)
cargo install wasm-pack

# Verify
wasm-pack --version
```

### Build Steps

```bash
# 1. Navigate to WASM project
cd /Users/alperkosan/dawg/client/src/lib/wasm/dawg-audio-dsp

# 2. Build for web (release mode, optimized)
wasm-pack build --target web --release

# This will:
# - Compile Rust → WebAssembly
# - Generate JavaScript glue code
# - Create TypeScript definitions
# - Output to pkg/ directory

# 3. Copy built files to public directory
cp pkg/dawg_audio_dsp_bg.wasm ../../../public/wasm/
cp pkg/dawg_audio_dsp.js ../../../public/wasm/
cp pkg/dawg_audio_dsp.d.ts ../../../public/wasm/

# 4. Verify files copied
ls -lh ../../../public/wasm/

echo "✅ WASM rebuild complete!"
```

### Expected Output
```
pkg/
├── dawg_audio_dsp_bg.wasm     (~50KB - compiled WebAssembly)
├── dawg_audio_dsp.js          (~10KB - JavaScript glue code)
├── dawg_audio_dsp.d.ts        (~2KB - TypeScript definitions)
└── package.json
```

---

## 🧪 Testing After Rebuild

### 1. Reload Application
```bash
# If dev server is running, restart it
cd /Users/alperkosan/dawg/client
npm run dev
```

### 2. Test Piano Sound
- Load a piano sample
- Play notes at center pan
- Verify no distortion/saturation
- Expected: Clean, clear sound

### 3. Verify Gain Levels
Open browser console:
```javascript
// Should see unity gain at center pan
console.log('Testing WASM fixes...')
```

---

## 🎯 Expected Results

### Before Fixes:
- ❌ Piano sounds distorted
- ❌ Center pan = -3dB loss per channel
- ❌ Compression parameters not configurable
- ❌ 20 channels × -3dB = massive gain loss

### After Fixes:
- ✅ Clean piano sound
- ✅ Center pan = 0dB (unity gain)
- ✅ Compression fully configurable from JavaScript
- ✅ RAW signal path achieved

---

## 🔍 Root Cause Analysis

### Why Piano Was Distorted

**Multiple Compounding Issues:**

1. **Pan Bug (-3dB loss per channel)**
   - All 20 channels at center pan
   - Each losing 3dB
   - Combined effect: massive gain imbalance

2. **Velocity Mapping (Fixed Previously)**
   - Was 0.3-0.7 range (too narrow)
   - Now 0-1.0 (full MIDI range)

3. **Hardcoded Compression**
   - Threshold: -10dB (too aggressive)
   - Ratio: 4:1 (hard knee)
   - Applied even when comp_active=false potentially

**Combined Effect:**
- Piano sample enters at normal level
- Loses 3dB due to pan bug
- Gets compressed by hardcoded compressor
- Results in distorted, saturated sound

---

## 📊 Technical Details

### Pan Formula Mathematics

**Two Panning Laws:**

1. **Constant Power Panning** (Professional Standard)
   - Total power remains constant: `L² + R² = constant`
   - Center pan: both channels at 0.707 (-3dB)
   - Advantage: Perceived loudness constant across pan
   - Used in: Professional DAWs (FL Studio, Ableton, etc.)

2. **Linear Panning** (RAW Signal - Applied ✅)
   - Center pan: both channels at 1.0 (0dB)
   - Pan left: fade out right channel
   - Pan right: fade out left channel
   - Advantage: No gain reduction at center = RAW signal
   - Used in: When you want unity gain at center

**Our Choice: Linear Panning**
Reason: RAW signal philosophy - no automatic gain reduction!

**Formula Applied:**
```rust
// pan = -1.0 (full left)
left_gain = 1.0, right_gain = 0.0

// pan = 0.0 (center)
left_gain = 1.0, right_gain = 1.0  // ✅ Unity gain!

// pan = +1.0 (full right)
left_gain = 0.0, right_gain = 1.0
```

---

**Generated:** 2025-10-22
**Status:** ✅ ALL FIXES APPLIED - Ready to Rebuild
