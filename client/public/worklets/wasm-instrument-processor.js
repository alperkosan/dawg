// public/worklets/wasm-instrument-processor.js

class WasmInstrumentProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.sampleRate = globalThis.sampleRate || 44100;
        this.polySynth = null;
        this.isInitialized = false;

        // Initialize Wasm
        this.port.onmessage = async (event) => {
            if (event.data.type === 'init-wasm') {
                await this.initWasm(event.data.wasmPath);
            } else if (this.isInitialized) {
                this.handleMessage(event.data);
            }
        };
    }

    async initWasm(wasmPath) {
        try {
            // Load Wasm Module
            const wasmModule = await import(wasmPath);
            await wasmModule.default();

            // Create PolySynth instance (16 voices)
            this.polySynth = new wasmModule.PolySynth(this.sampleRate, 16);
            this.isInitialized = true;

            this.port.postMessage({ type: 'initialized' });
            console.log('✅ Wasm Instrument Processor Initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Wasm PolySynth:', error);
            this.port.postMessage({ type: 'error', error: error.message });
        }
    }

    handleMessage(data) {
        if (!this.polySynth) return;

        switch (data.type) {
            case 'noteOn':
                this.polySynth.trigger_note(data.pitch, data.velocity);
                break;
            case 'noteOff':
                this.polySynth.release_note(data.pitch);
                break;
            case 'setParam':
                // TODO: Implement parameter binding in Rust
                break;
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channelL = output[0];
        const channelR = output[1];

        if (!this.isInitialized || !this.polySynth) {
            return true;
        }

        // Process block
        // Note: Currently PolySynth processes sample-by-sample internally in a loop in Rust.
        // For better performance, we should expose a process_block method in Rust that takes a pointer/slice.
        // But for Phase 2 proof-of-concept, we'll do the loop here or add process_block to Rust later.

        // Actually, calling generic `process()` 128 times from JS is costly due to boundary crossing overhead.
        // Optimization: We should update PolySynth to accept a buffer or return a buffer.

        // For now, let's assume valid output for verification.
        // In Phase 2 optimization, we will add `process_block` to PolySynth.

        for (let i = 0; i < channelL.length; i++) {
            const sample = this.polySynth.process();
            channelL[i] = sample;
            if (channelR) channelR[i] = sample;
        }

        return true;
    }
}

registerProcessor('wasm-instrument-processor', WasmInstrumentProcessor);
