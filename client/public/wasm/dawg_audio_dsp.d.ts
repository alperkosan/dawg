/* tslint:disable */
/* eslint-disable */
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
export class ReverbProcessor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number);
  process(input_l: Float32Array, input_r: Float32Array, output_l: Float32Array, output_r: Float32Array, size: number, decay: number, damping: number, pre_delay_time: number, wet: number, early_late_mix: number, width: number, mod_depth: number, mod_rate: number): void;
  reset(): void;
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
export class UnifiedMixerProcessor {
  free(): void;
  [Symbol.dispose](): void;
  constructor(sample_rate: number, num_channels: number);
  /**
   * Process all channels and mix to stereo output
   *
   * # Arguments
   * * `interleaved_inputs` - Flat array: [ch0_L_s0, ch0_R_s0, ch1_L_s0, ch1_R_s0, ..., ch0_L_s1, ch0_R_s1, ...]
   * * `output_l` - Left channel output buffer
   * * `output_r` - Right channel output buffer
   * * `block_size` - Number of samples per block
   * * `num_channels` - Number of input channels
   */
  process_mix(interleaved_inputs: Float32Array, output_l: Float32Array, output_r: Float32Array, block_size: number, num_channels: number): void;
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
  readonly __wbg_unifiedmixerprocessor_free: (a: number, b: number) => void;
  readonly unifiedmixerprocessor_new: (a: number, b: number) => number;
  readonly unifiedmixerprocessor_process_mix: (a: number, b: number, c: number, d: number, e: number, f: any, g: number, h: number, i: any, j: number, k: number) => void;
  readonly unifiedmixerprocessor_set_channel_params: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly unifiedmixerprocessor_set_channel_eq: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly unifiedmixerprocessor_set_channel_compression: (a: number, b: number, c: number, d: number) => void;
  readonly unifiedmixerprocessor_reset: (a: number) => void;
  readonly unifiedmixerprocessor_get_num_channels: (a: number) => number;
  readonly __wbg_reverbprocessor_free: (a: number, b: number) => void;
  readonly reverbprocessor_new: (a: number) => number;
  readonly reverbprocessor_process: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: number, j: number, k: any, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number) => void;
  readonly reverbprocessor_reset: (a: number) => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
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
