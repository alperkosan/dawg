# Audio Engine Engineering Report

> 📚 [← Back to System Index](./index.md) | [← Documentation Hub](../README.md)

This report provides a deep technical analysis of the DAWG audio engine.

---

## ⚡ Performance Critical Components

| Component | Function | Cost Per Frame | Notes |
|:---|:---|:---|:---|
| `UnifiedMixerProcessor` | `process_mix()` | ~0.5ms @ 128 samples | The absolute hot path |
| `PlaybackManager` | `_scheduleInstrumentNotes()` | N/A (on-demand) | Runs on play/seek |
| `NativeTransportSystem` | `_tickLoop()` | ~0.1ms @ 60Hz | Transport timing |

---

## 🏛️ Architecture Overview

The audio engine uses a **Hybrid JS/Wasm Architecture**. High-level orchestration, state management, and Web Audio API node connections are handled in JavaScript, while CPU-intensive digital signal processing (DSP) is offloaded to Wasm-compiled Rust code.

### 🧩 Core Components

1.  **`NativeAudioEngine`**: The central orchestrator (Singleton). It manages the `AudioContext`, the master mixer chain, and all instrument/effect instances.
    - **File**: `client/src/lib/core/NativeAudioEngine.js`
2.  **`PlaybackManager`**: Handles precise timing and scheduling of notes and loops using the `NativeTransportSystem`.
    - **File**: `client/src/lib/core/PlaybackManager.js`
3.  **`ImprovedWorkletManager`**: Manages the lifecycle of `AudioWorklet` nodes, ensuring worklets are loaded and initialized before audio starts.
    - **File**: `client/src/lib/core/ImprovedWorkletManager.js`
4.  **`dawg-audio-dsp` (Wasm)**: The high-performance DSP core written in Rust.
    - **File**: `client/src/lib/wasm/dawg-audio-dsp/src/lib.rs`

---

## 🧪 DSP Implementation (Rust/Wasm)

The Rust layer provides modular audio processors that are integrated into JS `AudioWorkletProcessor`s.

### 🔊 3-Band EQ (`ThreeBandEQ`)
- **Algorithm**: Biquad Filter (Direct Form II).
- **Bands**: Low-shelf, Peaking (mid), High-shelf.
- **Performance**: Pre-calculated coefficients to minimize per-sample overhead.

### 🎛️ Unified Mixer (`UnifiedMixerProcessor`)
- **Capacity**: N-channel mixer (dynamic).
- **Features**: Per-channel Gain, Pan, Mute, Solo, EQ, Compression.
- **Memory Layout**: Interleaved stereo `Float32Array`.

### 🌫️ Reverb (`ReverbProcessor`)
- **Algorithm**: Multi-comb filter reverb with allpass diffusion.
- **Features**: Early reflections, tunable decay, LFO modulation.

---

## 📈 Signal Flow Diagram

```mermaid
graph LR
    Inst[Instrument Slot] --> MixerCh[Wasm Channel Strip]
    MixerCh --> FX[Insert Effects]
    FX --> Master[Master Bus]
    Master --> Comp[Master Compressor]
    Comp --> Lim[Master Limiter]
    Lim --> Out[Hardware Output]
```

---

**Last Updated:** 2025-12-25
