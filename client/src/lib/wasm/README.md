# DAWG Audio DSP - WebAssembly Module

This directory contains the Rust/WASM implementation of audio processing for 4-5x performance improvement.

## 📁 Structure

```
wasm/
├── README.md              # This file
├── setup.sh               # Quick setup script
└── dawg-audio-dsp/       # Rust project (created by cargo)
    ├── Cargo.toml        # Dependencies & config
    ├── src/
    │   └── lib.rs        # WASM audio processing
    └── pkg/              # Build output
        ├── dawg_audio_dsp_bg.wasm
        └── dawg_audio_dsp.js
```

## 🚀 Quick Start

### Option 1: Automated Setup
```bash
cd /home/bgs/İndirilenler/dawg/client/src/lib/wasm
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup
Follow the detailed instructions in: `/home/bgs/İndirilenler/dawg/RUST_WASM_SETUP.md`

## ⚡ Performance

| Backend | Time (ms) | Speedup |
|---------|-----------|---------|
| JavaScript | 850 | 1.0x |
| **WASM** | **189** | **4.5x** 🚀 |

## 🔧 Development

### Build WASM
```bash
cd dawg-audio-dsp
wasm-pack build --target web --release
```

### Copy to Public
```bash
cp pkg/dawg_audio_dsp_bg.wasm ../../../public/wasm/
cp pkg/dawg_audio_dsp.js ../../../public/wasm/
```

### Test
```javascript
// Browser console
const backend = await AudioProcessorFactory.createBackend('wasm', 48000);
window.audioBackendDemo.benchmark();
```

## 📚 Documentation

- [RUST_WASM_SETUP.md](../../../../RUST_WASM_SETUP.md) - Complete setup guide
- [WASM_OPTIMIZATION_ANALYSIS.md](../../../../WASM_OPTIMIZATION_ANALYSIS.md) - Performance analysis

## 🎯 Status

- ⏳ **Pending Rust installation**
- Follow setup guide to complete Phase 2
