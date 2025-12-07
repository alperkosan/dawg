let wasm;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

export function set_panic_hook() {
    wasm.set_panic_hook();
}

/**
 * @param {number} size
 * @returns {number}
 */
export function allocate_f32_array(size) {
    const ret = wasm.allocate_f32_array(size);
    return ret >>> 0;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_0.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

const AdsrEnvelopeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_adsrenvelope_free(ptr >>> 0, 1));

export class AdsrEnvelope {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AdsrEnvelope.prototype);
        obj.__wbg_ptr = ptr;
        AdsrEnvelopeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AdsrEnvelopeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_adsrenvelope_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get attack_time() {
        const ret = wasm.__wbg_get_adsrenvelope_attack_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set attack_time(arg0) {
        wasm.__wbg_set_adsrenvelope_attack_time(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get decay_time() {
        const ret = wasm.__wbg_get_adsrenvelope_decay_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set decay_time(arg0) {
        wasm.__wbg_set_adsrenvelope_decay_time(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get sustain_level() {
        const ret = wasm.__wbg_get_adsrenvelope_sustain_level(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set sustain_level(arg0) {
        wasm.__wbg_set_adsrenvelope_sustain_level(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get release_time() {
        const ret = wasm.__wbg_get_adsrenvelope_release_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set release_time(arg0) {
        wasm.__wbg_set_adsrenvelope_release_time(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} sample_rate
     * @returns {AdsrEnvelope}
     */
    static new(sample_rate) {
        const ret = wasm.adsrenvelope_new(sample_rate);
        return AdsrEnvelope.__wrap(ret);
    }
    /**
     * @param {number} attack
     * @param {number} decay
     * @param {number} sustain
     * @param {number} release
     */
    set_params(attack, decay, sustain, release) {
        wasm.adsrenvelope_set_params(this.__wbg_ptr, attack, decay, sustain, release);
    }
    trigger() {
        wasm.adsrenvelope_trigger(this.__wbg_ptr);
    }
    release() {
        wasm.adsrenvelope_release(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    process() {
        const ret = wasm.adsrenvelope_process(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    is_active() {
        const ret = wasm.adsrenvelope_is_active(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get_value() {
        const ret = wasm.adsrenvelope_get_value(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) AdsrEnvelope.prototype[Symbol.dispose] = AdsrEnvelope.prototype.free;

const AudioGraphFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_audiograph_free(ptr >>> 0, 1));
/**
 * The main Audio Graph structure exposed to JavaScript.
 * It acts as the container and conductor for all audio nodes.
 */
export class AudioGraph {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AudioGraphFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_audiograph_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.audiograph_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        AudioGraphFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Process a block of audio for the entire graph.
     * This is the entry point called by the AudioWorklet.
     * @param {Float32Array} output_l
     * @param {Float32Array} output_r
     */
    process_block(output_l, output_r) {
        var ptr0 = passArrayF32ToWasm0(output_l, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = passArrayF32ToWasm0(output_r, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        wasm.audiograph_process_block(this.__wbg_ptr, ptr0, len0, output_l, ptr1, len1, output_r);
    }
    /**
     * Add a test node (just to verify infrastructure)
     * @returns {number}
     */
    add_test_node() {
        const ret = wasm.audiograph_add_test_node(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) AudioGraph.prototype[Symbol.dispose] = AudioGraph.prototype.free;

const BiquadFilterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_biquadfilter_free(ptr >>> 0, 1));

export class BiquadFilter {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BiquadFilterFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_biquadfilter_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.biquadfilter_new();
        this.__wbg_ptr = ret >>> 0;
        BiquadFilterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Process single sample through biquad filter
     * @param {number} input
     * @returns {number}
     */
    process(input) {
        const ret = wasm.biquadfilter_process(this.__wbg_ptr, input);
        return ret;
    }
    /**
     * Set filter coefficients
     * @param {number} b0
     * @param {number} b1
     * @param {number} b2
     * @param {number} a1
     * @param {number} a2
     */
    set_coefficients(b0, b1, b2, a1, a2) {
        wasm.biquadfilter_set_coefficients(this.__wbg_ptr, b0, b1, b2, a1, a2);
    }
    /**
     * Reset filter state
     */
    reset() {
        wasm.biquadfilter_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) BiquadFilter.prototype[Symbol.dispose] = BiquadFilter.prototype.free;

const PolySynthFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_polysynth_free(ptr >>> 0, 1));

export class PolySynth {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PolySynthFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_polysynth_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     * @param {number} max_voices
     */
    constructor(sample_rate, max_voices) {
        const ret = wasm.polysynth_new(sample_rate, max_voices);
        this.__wbg_ptr = ret >>> 0;
        PolySynthFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} note
     * @param {number} velocity
     */
    trigger_note(note, velocity) {
        wasm.polysynth_trigger_note(this.__wbg_ptr, note, velocity);
    }
    /**
     * @param {number} note
     */
    release_note(note) {
        wasm.polysynth_release_note(this.__wbg_ptr, note);
    }
    /**
     * @param {number} cutoff
     * @param {number} q
     * @param {number} filter_type_idx
     */
    set_filter_params(cutoff, q, filter_type_idx) {
        wasm.polysynth_set_filter_params(this.__wbg_ptr, cutoff, q, filter_type_idx);
    }
    /**
     * @returns {number}
     */
    process() {
        const ret = wasm.polysynth_process(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) PolySynth.prototype[Symbol.dispose] = PolySynth.prototype.free;

const ReverbProcessorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_reverbprocessor_free(ptr >>> 0, 1));

export class ReverbProcessor {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ReverbProcessorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_reverbprocessor_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.reverbprocessor_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        ReverbProcessorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} input_l
     * @param {Float32Array} input_r
     * @param {Float32Array} output_l
     * @param {Float32Array} output_r
     * @param {number} size
     * @param {number} decay
     * @param {number} damping
     * @param {number} pre_delay_time
     * @param {number} wet
     * @param {number} early_late_mix
     * @param {number} width
     * @param {number} mod_depth
     * @param {number} mod_rate
     */
    process(input_l, input_r, output_l, output_r, size, decay, damping, pre_delay_time, wet, early_late_mix, width, mod_depth, mod_rate) {
        const ptr0 = passArrayF32ToWasm0(input_l, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(input_r, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = passArrayF32ToWasm0(output_l, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = passArrayF32ToWasm0(output_r, wasm.__wbindgen_malloc);
        var len3 = WASM_VECTOR_LEN;
        wasm.reverbprocessor_process(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, output_l, ptr3, len3, output_r, size, decay, damping, pre_delay_time, wet, early_late_mix, width, mod_depth, mod_rate);
    }
    reset() {
        wasm.reverbprocessor_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) ReverbProcessor.prototype[Symbol.dispose] = ReverbProcessor.prototype.free;

const SamplerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sampler_free(ptr >>> 0, 1));

export class Sampler {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SamplerFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sampler_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.sampler_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        SamplerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Load sample data (Mono or Stereo)
     * @param {Float32Array} left_channel
     * @param {Float32Array} right_channel
     */
    load_sample(left_channel, right_channel) {
        const ptr0 = passArrayF32ToWasm0(left_channel, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(right_channel, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.sampler_load_sample(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @returns {number}
     */
    get_current_right() {
        const ret = wasm.sampler_get_current_right(this.__wbg_ptr);
        return ret;
    }
    /**
     * Process next sample (Stereo capable)
     * @returns {number}
     */
    process() {
        const ret = wasm.sampler_process(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} attack
     * @param {number} decay
     * @param {number} sustain
     * @param {number} release
     */
    set_adsr(attack, decay, sustain, release) {
        wasm.sampler_set_adsr(this.__wbg_ptr, attack, decay, sustain, release);
    }
    /**
     * @param {number} cutoff
     * @param {number} q
     * @param {number} filter_type_idx
     * @param {boolean} enabled
     */
    set_filter(cutoff, q, filter_type_idx, enabled) {
        wasm.sampler_set_filter(this.__wbg_ptr, cutoff, q, filter_type_idx, enabled);
    }
    /**
     * @param {number} amount
     */
    set_bass_boost(amount) {
        wasm.sampler_set_bass_boost(this.__wbg_ptr, amount);
    }
    release() {
        wasm.sampler_release(this.__wbg_ptr);
    }
    play() {
        wasm.sampler_play(this.__wbg_ptr);
    }
    stop() {
        wasm.sampler_stop(this.__wbg_ptr);
    }
    /**
     * @param {number} speed
     */
    set_speed(speed) {
        wasm.sampler_set_speed(this.__wbg_ptr, speed);
    }
    /**
     * @param {number} position
     */
    set_position(position) {
        wasm.sampler_set_position(this.__wbg_ptr, position);
    }
    /**
     * @param {number} start
     * @param {number} end
     */
    set_range(start, end) {
        wasm.sampler_set_range(this.__wbg_ptr, start, end);
    }
    /**
     * @returns {number}
     */
    get_length() {
        const ret = wasm.sampler_get_length(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} start
     * @param {number} end
     * @param {boolean} loop_active
     */
    set_loop(start, end, loop_active) {
        wasm.sampler_set_loop(this.__wbg_ptr, start, end, loop_active);
    }
    /**
     * @returns {boolean}
     */
    is_playing() {
        const ret = wasm.sampler_is_playing(this.__wbg_ptr);
        return ret !== 0;
    }
    reset() {
        wasm.sampler_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) Sampler.prototype[Symbol.dispose] = Sampler.prototype.free;

const SimpleDelayFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_simpledelay_free(ptr >>> 0, 1));

export class SimpleDelay {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SimpleDelayFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_simpledelay_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.simpledelay_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        SimpleDelayFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} seconds
     */
    set_time(seconds) {
        wasm.simpledelay_set_time(this.__wbg_ptr, seconds);
    }
    /**
     * @param {number} val
     */
    set_feedback(val) {
        wasm.simpledelay_set_feedback(this.__wbg_ptr, val);
    }
    /**
     * @param {number} val
     */
    set_mix(val) {
        wasm.simpledelay_set_mix(this.__wbg_ptr, val);
    }
}
if (Symbol.dispose) SimpleDelay.prototype[Symbol.dispose] = SimpleDelay.prototype.free;

const ThreeBandEQFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_threebandeq_free(ptr >>> 0, 1));

export class ThreeBandEQ {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ThreeBandEQFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_threebandeq_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.threebandeq_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        ThreeBandEQFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Update EQ coefficients
     * @param {number} low_gain
     * @param {number} mid_gain
     * @param {number} high_gain
     * @param {number} low_freq
     * @param {number} high_freq
     */
    update_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq) {
        wasm.threebandeq_update_coefficients(this.__wbg_ptr, low_gain, mid_gain, high_gain, low_freq, high_freq);
    }
    /**
     * Process single sample through 3-band EQ
     * @param {number} input
     * @returns {number}
     */
    process(input) {
        const ret = wasm.threebandeq_process(this.__wbg_ptr, input);
        return ret;
    }
    /**
     * Reset all filters
     */
    reset() {
        wasm.threebandeq_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) ThreeBandEQ.prototype[Symbol.dispose] = ThreeBandEQ.prototype.free;

const UnifiedMixerProcessorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_unifiedmixerprocessor_free(ptr >>> 0, 1));

export class UnifiedMixerProcessor {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        UnifiedMixerProcessorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_unifiedmixerprocessor_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     * @param {number} num_channels
     */
    constructor(sample_rate, num_channels) {
        const ret = wasm.unifiedmixerprocessor_new(sample_rate, num_channels);
        this.__wbg_ptr = ret >>> 0;
        UnifiedMixerProcessorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Process all channels and mix to stereo output
     *
     * # Arguments
     * * `interleaved_inputs` - Flat array: [ch0_L_s0, ch0_R_s0, ch1_L_s0, ch1_R_s0, ..., ch0_L_s1, ch0_R_s1, ...]
     * * `output_l` - Left channel output buffer
     * * `output_r` - Right channel output buffer
     * * `block_size` - Number of samples per block
     * * `num_channels` - Number of input channels
     * @param {number} interleaved_ptr
     * @param {number} input_len
     * @param {number} out_l_ptr
     * @param {number} out_r_ptr
     * @param {number} block_size
     */
    process_mix(interleaved_ptr, input_len, out_l_ptr, out_r_ptr, block_size) {
        wasm.unifiedmixerprocessor_process_mix(this.__wbg_ptr, interleaved_ptr, input_len, out_l_ptr, out_r_ptr, block_size);
    }
    /**
     * Update channel parameters
     * @param {number} channel_idx
     * @param {number} gain
     * @param {number} pan
     * @param {boolean} mute
     * @param {boolean} solo
     * @param {boolean} eq_active
     * @param {boolean} comp_active
     */
    set_channel_params(channel_idx, gain, pan, mute, solo, eq_active, comp_active) {
        wasm.unifiedmixerprocessor_set_channel_params(this.__wbg_ptr, channel_idx, gain, pan, mute, solo, eq_active, comp_active);
    }
    /**
     * Update channel EQ coefficients
     * @param {number} channel_idx
     * @param {number} low_gain
     * @param {number} mid_gain
     * @param {number} high_gain
     * @param {number} low_freq
     * @param {number} high_freq
     */
    set_channel_eq(channel_idx, low_gain, mid_gain, high_gain, low_freq, high_freq) {
        wasm.unifiedmixerprocessor_set_channel_eq(this.__wbg_ptr, channel_idx, low_gain, mid_gain, high_gain, low_freq, high_freq);
    }
    /**
     * Update channel compression parameters
     * @param {number} channel_idx
     * @param {number} threshold
     * @param {number} ratio
     */
    set_channel_compression(channel_idx, threshold, ratio) {
        wasm.unifiedmixerprocessor_set_channel_compression(this.__wbg_ptr, channel_idx, threshold, ratio);
    }
    /**
     * Reset all channels
     */
    reset() {
        wasm.unifiedmixerprocessor_reset(this.__wbg_ptr);
    }
    /**
     * Get number of channels
     * @returns {number}
     */
    get_num_channels() {
        const ret = wasm.unifiedmixerprocessor_get_num_channels(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Add an effect to a channel
     *
     * effect_type: 0 = Simple Delay
     * @param {number} channel_idx
     * @param {number} effect_type
     */
    add_effect(channel_idx, effect_type) {
        const ret = wasm.unifiedmixerprocessor_add_effect(this.__wbg_ptr, channel_idx, effect_type);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * fast polling of levels
     * @param {number} levels_ptr
     * @param {number} len
     */
    get_channel_levels(levels_ptr, len) {
        wasm.unifiedmixerprocessor_get_channel_levels(this.__wbg_ptr, levels_ptr, len);
    }
}
if (Symbol.dispose) UnifiedMixerProcessor.prototype[Symbol.dispose] = UnifiedMixerProcessor.prototype.free;

const WasmAudioProcessorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmaudioprocessor_free(ptr >>> 0, 1));

export class WasmAudioProcessor {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmAudioProcessorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmaudioprocessor_free(ptr, 0);
    }
    /**
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.wasmaudioprocessor_new(sample_rate);
        this.__wbg_ptr = ret >>> 0;
        WasmAudioProcessorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Process stereo buffer
     * @param {Float32Array} input_l
     * @param {Float32Array} input_r
     * @param {Float32Array} output_l
     * @param {Float32Array} output_r
     * @param {boolean} eq_active
     * @param {boolean} comp_active
     * @param {number} gain
     * @param {number} pan
     * @param {boolean} mono
     * @param {number} threshold
     * @param {number} ratio
     */
    process_buffer(input_l, input_r, output_l, output_r, eq_active, comp_active, gain, pan, mono, threshold, ratio) {
        const ptr0 = passArrayF32ToWasm0(input_l, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(input_r, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = passArrayF32ToWasm0(output_l, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = passArrayF32ToWasm0(output_r, wasm.__wbindgen_malloc);
        var len3 = WASM_VECTOR_LEN;
        wasm.wasmaudioprocessor_process_buffer(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, output_l, ptr3, len3, output_r, eq_active, comp_active, gain, pan, mono, threshold, ratio);
    }
    /**
     * Update EQ settings
     * @param {number} low_gain
     * @param {number} mid_gain
     * @param {number} high_gain
     * @param {number} low_freq
     * @param {number} high_freq
     */
    update_eq_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq) {
        wasm.wasmaudioprocessor_update_eq_coefficients(this.__wbg_ptr, low_gain, mid_gain, high_gain, low_freq, high_freq);
    }
    /**
     * Reset all state
     */
    reset() {
        wasm.wasmaudioprocessor_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) WasmAudioProcessor.prototype[Symbol.dispose] = WasmAudioProcessor.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_wbindgencopytotypedarray_d105febdb9374ca3 = function(arg0, arg1, arg2) {
        new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_wbindgenthrow_451ec1a8469d7eb6 = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('dawg_audio_dsp_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
