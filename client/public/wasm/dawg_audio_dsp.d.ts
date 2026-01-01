/* tslint:disable */
/* eslint-disable */
export function set_panic_hook(): void;
export function allocate_f32_array(size: number): number;
export class AdsrEnvelope {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static new(sample_rate: number): AdsrEnvelope;
  set_params(attack: number, decay: number, sustain: number, release: number): void;
  trigger(): void;
  release(): void;
  process(): number;
  is_active(): boolean;
  get_value(): number;
  attack_time: number;
  decay_time: number;
  sustain_level: number;
  release_time: number;
}
/**
 * The main Audio Graph structure exposed to JavaScript.
 * It acts as the container and conductor for all audio nodes.
 */
export class AudioGraph {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  /**
   * Process a block of audio for the entire graph.
   * This is the entry point called by the AudioWorklet.
   */
  process_block(output_l: Float32Array, output_r: Float32Array): void;
  /**
   * Add a test node (just to verify infrastructure)
   */
  add_test_node(): number;
}
export class BiquadFilter {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  /**
   * Process single sample through biquad filter
   */
  process(input: number): number;
  /**
   * Set filter coefficients
   */
  set_coefficients(b0: number, b1: number, b2: number, a1: number, a2: number): void;
  /**
   * Reset filter state
   */
  reset(): void;
}
export class Chorus {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_rate(hz: number): void;
  set_depth(val: number): void;
  set_mix(val: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
  reset(): void;
}
export class Clipper {
  free(): void;
  [Symbol.dispose](): void;
  constructor(_sample_rate: number);
  set_threshold(val: number): void;
  set_softness(val: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
}
export class Compressor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_threshold(db: number): void;
  set_ratio(ratio: number): void;
  set_attack(seconds: number): void;
  set_release(seconds: number): void;
  set_knee(db: number): void;
  set_makeup_gain(db: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
  reset(): void;
}
export class Limiter {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_threshold(db: number): void;
  set_release(seconds: number): void;
  set_ceiling(db: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
  reset(): void;
}
export class Phaser {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_rate(hz: number): void;
  set_depth(val: number): void;
  set_feedback(val: number): void;
  set_stages(stages: number): void;
  set_mix(val: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
  reset(): void;
}
export class PolySynth {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number, max_voices: number);
  trigger_note(note: number, velocity: number): void;
  release_note(note: number): void;
  set_filter_params(cutoff: number, q: number, filter_type_idx: number): void;
  process(): number;
}
export class ReverbProcessor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array, size: number, decay: number, damping: number, pre_delay_time: number, wet: number, early_late_mix: number, width: number, mod_depth: number, mod_rate: number): void;
  reset(): void;
}
export class Sampler {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  /**
   * Load sample data (Mono or Stereo)
   */
  load_sample(left_channel: Float32Array, right_channel: Float32Array): void;
  get_current_right(): number;
  /**
   * Process next sample (Stereo capable)
   */
  process(): number;
  set_adsr(attack: number, decay: number, sustain: number, release: number): void;
  set_filter(cutoff: number, q: number, filter_type_idx: number, enabled: boolean): void;
  set_bass_boost(amount: number): void;
  release(): void;
  play(): void;
  stop(): void;
  set_speed(speed: number): void;
  set_position(position: number): void;
  set_range(start: number, end: number): void;
  get_length(): number;
  set_loop(start: number, end: number, loop_active: boolean): void;
  is_playing(): boolean;
  reset(): void;
}
export class Saturator {
  free(): void;
  [Symbol.dispose](): void;
  constructor(_sample_rate: number);
  set_drive(val: number): void;
  set_mix(val: number): void;
  set_mode(mode: number): void;
  set_output_gain(db: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array): void;
}
export class SharedAudioState {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static idx_play_state(): number;
  static idx_msg_counter(): number;
  static idx_seek_trigger(): number;
  static idx_bpm(): number;
  static idx_position_samples(): number;
  static idx_position_ticks(): number;
  static idx_sample_rate(): number;
  static idx_seek_target(): number;
  static idx_loop_enabled(): number;
  static idx_loop_start(): number;
  static idx_loop_end(): number;
}
export class SimpleDelay {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_time(seconds: number): void;
  set_feedback(val: number): void;
  set_mix(val: number): void;
}
export class StereoPanner {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_pan(val: number): void;
  set_width(val: number): void;
  set_lfo_rate(hz: number): void;
  set_lfo_depth(val: number): void;
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array, sample_rate: number): void;
}
export class ThreeBandEQ {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  /**
   * Update EQ coefficients
   */
  update_coefficients(low_gain: number, mid_gain: number, high_gain: number, low_freq: number, high_freq: number): void;
  /**
   * Process single sample through 3-band EQ
   */
  process(input: number): number;
  /**
   * Reset all filters
   */
  reset(): void;
}
export class Transport {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  set_bpm(bpm: number): void;
  set_sample_rate(sample_rate: number): void;
  play(): void;
  stop(): void;
  pause(): void;
  /**
   * Advance time by N samples with Looping support
   */
  advance(samples: bigint): void;
  set_loop(enabled: boolean, start_tick: number, end_tick: number): void;
  /**
   * Set absolute position (seek)
   */
  set_position_samples(samples: bigint): void;
  get_current_time(): number;
  get_current_beat(): number;
  get_current_tick(): number;
  is_playing: boolean;
  sample_rate: number;
  bpm: number;
  current_sample: bigint;
  ppq: number;
  loop_enabled: boolean;
  loop_start_tick: number;
  loop_end_tick: number;
}
export class UnifiedMixerProcessor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number, num_channels: number);
  /**
   * Set the shared state buffer pointer (SAB)
   */
  set_shared_state_buffer(ptr: number): void;
  /**
   * Process all channels and mix to stereo output
   *
   * # Arguments
   * * `interleaved_inputs` - Flat array: [ch0_L_s0, ch0_R_s0, ch1_L_s0, ch1_R_s0, ..., ch0_L_s1, ch0_R_s1, ...]
   * * `output_l` - Left channel output buffer
   */
  process_mix(interleaved_ptr: number, input_len: number, out_l_ptr: number, out_r_ptr: number, block_size: number): void;
  /**
   * Update channel parameters
   */
  set_channel_params(channel_idx: number, gain: number, pan: number, mute: boolean, solo: boolean, eq_active: boolean, comp_active: boolean): void;
  /**
   * Update channel EQ coefficients
   */
  set_channel_eq(channel_idx: number, low_gain: number, mid_gain: number, high_gain: number, low_freq: number, high_freq: number): void;
  /**
   * Update channel compression parameters
   */
  set_channel_compression(channel_idx: number, threshold: number, ratio: number): void;
  /**
   * Reset all channels
   */
  reset(): void;
  /**
   * Get number of channels
   */
  get_num_channels(): number;
  /**
   * Add an effect to a channel
   * 
   * effect_type: 0 = Simple Delay
   */
  add_effect(channel_idx: number, effect_type: number): void;
  /**
   * fast polling of levels
   */
  get_channel_levels(levels_ptr: number, len: number): void;
}
export class WasmAudioProcessor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  /**
   * Process stereo buffer
   */
  process_buffer(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array, eq_active: boolean, comp_active: boolean, gain: number, pan: number, mono: boolean, threshold: number, ratio: number): void;
  /**
   * Update EQ settings
   */
  update_eq_coefficients(low_gain: number, mid_gain: number, high_gain: number, low_freq: number, high_freq: number): void;
  /**
   * Reset all state
   */
  reset(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_audiograph_free: (a: number, b: number) => void;
  readonly audiograph_new: (a: number) => number;
  readonly audiograph_process_block: (a: number, b: number, c: number, d: any, e: number, f: number, g: any) => void;
  readonly audiograph_add_test_node: (a: number) => number;
  readonly __wbg_polysynth_free: (a: number, b: number) => void;
  readonly polysynth_new: (a: number, b: number) => number;
  readonly polysynth_trigger_note: (a: number, b: number, c: number) => void;
  readonly polysynth_release_note: (a: number, b: number) => void;
  readonly polysynth_set_filter_params: (a: number, b: number, c: number, d: number) => void;
  readonly polysynth_process: (a: number) => number;
  readonly __wbg_sampler_free: (a: number, b: number) => void;
  readonly sampler_new: (a: number) => number;
  readonly sampler_load_sample: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly sampler_get_current_right: (a: number) => number;
  readonly sampler_process: (a: number) => number;
  readonly sampler_set_adsr: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly sampler_set_filter: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly sampler_set_bass_boost: (a: number, b: number) => void;
  readonly sampler_release: (a: number) => void;
  readonly sampler_play: (a: number) => void;
  readonly sampler_stop: (a: number) => void;
  readonly sampler_set_speed: (a: number, b: number) => void;
  readonly sampler_set_position: (a: number, b: number) => void;
  readonly sampler_set_range: (a: number, b: number, c: number) => void;
  readonly sampler_get_length: (a: number) => number;
  readonly sampler_set_loop: (a: number, b: number, c: number, d: number) => void;
  readonly sampler_is_playing: (a: number) => number;
  readonly sampler_reset: (a: number) => void;
  readonly __wbg_adsrenvelope_free: (a: number, b: number) => void;
  readonly __wbg_get_adsrenvelope_attack_time: (a: number) => number;
  readonly __wbg_set_adsrenvelope_attack_time: (a: number, b: number) => void;
  readonly __wbg_get_adsrenvelope_decay_time: (a: number) => number;
  readonly __wbg_set_adsrenvelope_decay_time: (a: number, b: number) => void;
  readonly __wbg_get_adsrenvelope_sustain_level: (a: number) => number;
  readonly __wbg_set_adsrenvelope_sustain_level: (a: number, b: number) => void;
  readonly __wbg_get_adsrenvelope_release_time: (a: number) => number;
  readonly __wbg_set_adsrenvelope_release_time: (a: number, b: number) => void;
  readonly adsrenvelope_new: (a: number) => number;
  readonly adsrenvelope_set_params: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly adsrenvelope_trigger: (a: number) => void;
  readonly adsrenvelope_release: (a: number) => void;
  readonly adsrenvelope_process: (a: number) => number;
  readonly adsrenvelope_is_active: (a: number) => number;
  readonly adsrenvelope_get_value: (a: number) => number;
  readonly __wbg_simpledelay_free: (a: number, b: number) => void;
  readonly simpledelay_new: (a: number) => number;
  readonly simpledelay_set_time: (a: number, b: number) => void;
  readonly simpledelay_set_feedback: (a: number, b: number) => void;
  readonly simpledelay_set_mix: (a: number, b: number) => void;
  readonly __wbg_reverbprocessor_free: (a: number, b: number) => void;
  readonly reverbprocessor_new: (a: number) => number;
  readonly reverbprocessor_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number) => void;
  readonly reverbprocessor_reset: (a: number) => void;
  readonly compressor_new: (a: number) => number;
  readonly compressor_set_threshold: (a: number, b: number) => void;
  readonly compressor_set_ratio: (a: number, b: number) => void;
  readonly compressor_set_attack: (a: number, b: number) => void;
  readonly compressor_set_release: (a: number, b: number) => void;
  readonly compressor_set_knee: (a: number, b: number) => void;
  readonly compressor_set_makeup_gain: (a: number, b: number) => void;
  readonly compressor_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly compressor_reset: (a: number) => void;
  readonly __wbg_saturator_free: (a: number, b: number) => void;
  readonly saturator_new: (a: number) => number;
  readonly saturator_set_drive: (a: number, b: number) => void;
  readonly saturator_set_mode: (a: number, b: number) => void;
  readonly saturator_set_output_gain: (a: number, b: number) => void;
  readonly saturator_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly __wbg_limiter_free: (a: number, b: number) => void;
  readonly limiter_new: (a: number) => number;
  readonly limiter_set_threshold: (a: number, b: number) => void;
  readonly limiter_set_release: (a: number, b: number) => void;
  readonly limiter_set_ceiling: (a: number, b: number) => void;
  readonly limiter_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly limiter_reset: (a: number) => void;
  readonly __wbg_clipper_free: (a: number, b: number) => void;
  readonly clipper_new: (a: number) => number;
  readonly clipper_set_threshold: (a: number, b: number) => void;
  readonly clipper_set_softness: (a: number, b: number) => void;
  readonly clipper_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly __wbg_chorus_free: (a: number, b: number) => void;
  readonly chorus_new: (a: number) => number;
  readonly chorus_set_rate: (a: number, b: number) => void;
  readonly chorus_set_depth: (a: number, b: number) => void;
  readonly chorus_set_mix: (a: number, b: number) => void;
  readonly chorus_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly chorus_reset: (a: number) => void;
  readonly __wbg_phaser_free: (a: number, b: number) => void;
  readonly phaser_new: (a: number) => number;
  readonly phaser_set_rate: (a: number, b: number) => void;
  readonly phaser_set_depth: (a: number, b: number) => void;
  readonly phaser_set_feedback: (a: number, b: number) => void;
  readonly phaser_set_stages: (a: number, b: number) => void;
  readonly phaser_set_mix: (a: number, b: number) => void;
  readonly phaser_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any) => void;
  readonly phaser_reset: (a: number) => void;
  readonly stereopanner_new: (a: number) => number;
  readonly stereopanner_set_pan: (a: number, b: number) => void;
  readonly stereopanner_set_width: (a: number, b: number) => void;
  readonly stereopanner_set_lfo_rate: (a: number, b: number) => void;
  readonly stereopanner_set_lfo_depth: (a: number, b: number) => void;
  readonly stereopanner_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any, l: number) => void;
  readonly __wbg_transport_free: (a: number, b: number) => void;
  readonly __wbg_get_transport_is_playing: (a: number) => number;
  readonly __wbg_set_transport_is_playing: (a: number, b: number) => void;
  readonly __wbg_get_transport_sample_rate: (a: number) => number;
  readonly __wbg_set_transport_sample_rate: (a: number, b: number) => void;
  readonly __wbg_get_transport_bpm: (a: number) => number;
  readonly __wbg_set_transport_bpm: (a: number, b: number) => void;
  readonly __wbg_get_transport_current_sample: (a: number) => bigint;
  readonly __wbg_set_transport_current_sample: (a: number, b: bigint) => void;
  readonly __wbg_get_transport_ppq: (a: number) => number;
  readonly __wbg_set_transport_ppq: (a: number, b: number) => void;
  readonly __wbg_get_transport_loop_enabled: (a: number) => number;
  readonly __wbg_set_transport_loop_enabled: (a: number, b: number) => void;
  readonly __wbg_get_transport_loop_start_tick: (a: number) => number;
  readonly __wbg_set_transport_loop_start_tick: (a: number, b: number) => void;
  readonly __wbg_get_transport_loop_end_tick: (a: number) => number;
  readonly __wbg_set_transport_loop_end_tick: (a: number, b: number) => void;
  readonly transport_new: (a: number) => number;
  readonly transport_set_bpm: (a: number, b: number) => void;
  readonly transport_set_sample_rate: (a: number, b: number) => void;
  readonly transport_play: (a: number) => void;
  readonly transport_stop: (a: number) => void;
  readonly transport_pause: (a: number) => void;
  readonly transport_advance: (a: number, b: bigint) => void;
  readonly transport_set_loop: (a: number, b: number, c: number, d: number) => void;
  readonly transport_set_position_samples: (a: number, b: bigint) => void;
  readonly transport_get_current_time: (a: number) => number;
  readonly transport_get_current_beat: (a: number) => number;
  readonly transport_get_current_tick: (a: number) => number;
  readonly __wbg_sharedaudiostate_free: (a: number, b: number) => void;
  readonly sharedaudiostate_idx_play_state: () => number;
  readonly sharedaudiostate_idx_msg_counter: () => number;
  readonly sharedaudiostate_idx_seek_trigger: () => number;
  readonly sharedaudiostate_idx_bpm: () => number;
  readonly sharedaudiostate_idx_position_samples: () => number;
  readonly sharedaudiostate_idx_position_ticks: () => number;
  readonly sharedaudiostate_idx_sample_rate: () => number;
  readonly sharedaudiostate_idx_seek_target: () => number;
  readonly sharedaudiostate_idx_loop_enabled: () => number;
  readonly sharedaudiostate_idx_loop_start: () => number;
  readonly sharedaudiostate_idx_loop_end: () => number;
  readonly __wbg_biquadfilter_free: (a: number, b: number) => void;
  readonly biquadfilter_new: () => number;
  readonly biquadfilter_process: (a: number, b: number) => number;
  readonly biquadfilter_set_coefficients: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly biquadfilter_reset: (a: number) => void;
  readonly __wbg_threebandeq_free: (a: number, b: number) => void;
  readonly threebandeq_new: (a: number) => number;
  readonly threebandeq_update_coefficients: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly threebandeq_process: (a: number, b: number) => number;
  readonly threebandeq_reset: (a: number) => void;
  readonly __wbg_wasmaudioprocessor_free: (a: number, b: number) => void;
  readonly wasmaudioprocessor_new: (a: number) => number;
  readonly wasmaudioprocessor_process_buffer: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any, l: number, m: number, n: number, o: number, p: number, q: number, r: number) => void;
  readonly wasmaudioprocessor_update_eq_coefficients: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly wasmaudioprocessor_reset: (a: number) => void;
  readonly allocate_f32_array: (a: number) => number;
  readonly __wbg_unifiedmixerprocessor_free: (a: number, b: number) => void;
  readonly unifiedmixerprocessor_new: (a: number, b: number) => number;
  readonly unifiedmixerprocessor_set_shared_state_buffer: (a: number, b: number) => void;
  readonly unifiedmixerprocessor_process_mix: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly unifiedmixerprocessor_set_channel_params: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly unifiedmixerprocessor_set_channel_eq: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly unifiedmixerprocessor_set_channel_compression: (a: number, b: number, c: number, d: number) => void;
  readonly unifiedmixerprocessor_reset: (a: number) => void;
  readonly unifiedmixerprocessor_get_num_channels: (a: number) => number;
  readonly unifiedmixerprocessor_add_effect: (a: number, b: number, c: number) => [number, number];
  readonly unifiedmixerprocessor_get_channel_levels: (a: number, b: number, c: number) => void;
  readonly saturator_set_mix: (a: number, b: number) => void;
  readonly __wbg_stereopanner_free: (a: number, b: number) => void;
  readonly __wbg_compressor_free: (a: number, b: number) => void;
  readonly set_panic_hook: () => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
