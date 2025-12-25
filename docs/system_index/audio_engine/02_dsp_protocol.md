# Audio DSP Protocol Specification

This document defines the low-level communication protocol between the JavaScript main thread, the AudioWorklet thread, and the Wasm DSP module.

## 📡 Message Schema (JSON)

Communication occurs via the `port.postMessage()` API on `AudioWorkletNode`.

### 1. Update Parameter (`UPDATE_PARAM`)
Updates a single parameter on a specific channel strip or effect.

```typescript
interface UpdateParamMessage {
  type: 'UPDATE_PARAM';
  payload: {
    channelId: number; // 0-based index
    moduleId: 'eq' | 'comp' | 'gain' | 'pan';
    paramId: string;   // e.g., 'low_gain', 'threshold'
    value: number;     // Float32
  };
}
```

**Example:**
```json
{
  "type": "UPDATE_PARAM",
  "payload": {
    "channelId": 2,
    "moduleId": "eq",
    "paramId": "mid_gain",
    "value": 3.5
  }
}
```

### 2. Update Buffer (`UPDATE_BUFFER`)
Transfers logic-free audio data (like impulse responses for convolution) to the Worklet.

```typescript
interface UpdateBufferMessage {
  type: 'UPDATE_BUFFER';
  payload: {
    bufferId: string;
    data: Float32Array; // Transferable
  };
}
```

## 🧵 Threading Model

### Shared Memory Layout
To minimize garbage collection, we use a `WebAssembly.Memory` instance shared between JS and Rust.

| Offset | Size (Bytes) | Description |
| :--- | :--- | :--- |
| `0x0000` | `4096` | Input Buffer (Interleaved L/R) |
| `0x1000` | `4096` | Output Buffer (Interleaved L/R) |
| `0x2000` | `1024` | Control Block (params) |

### Processing Cycle
1.  **JS (Worklet)**: Copies input from Web Audio `inputs[][]` to **Input Buffer**.
2.  **Wasm**: `process(frames)` is called.
3.  **Rust**: Reads Input Buffer, computes 3-Band EQ + Compression, writes to **Output Buffer**.
4.  **JS (Worklet)**: Copies **Output Buffer** to Web Audio `outputs[][]`.

## ⚠️ Critical constraints
- **No Allocations**: The process loop must NEVER allocate memory. Arrays are pre-allocated.
- **Lock-Free**: Parameter updates are atomic `f32` writes; no mutexes used during audio processing.
