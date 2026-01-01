mod graph;
mod synth;
mod filters;
mod sampler;
mod simd_ops;
pub mod envelope;
pub mod effects;
pub use graph::AudioGraph;
use crate::graph::AudioNode;

use wasm_bindgen::prelude::*;

// Raw import with valid module path to appease browser loader
#[link(wasm_import_module = "./dawg-utils.js")]
extern "C" {
    fn host_log(ptr: *const u8, len: usize);
}

// Helper for logging (Nuclear Option)
fn worker_log(s: &str) {
    unsafe { host_log(s.as_ptr(), s.len()); }
}

// Enable better error messages in Wasm panics
#[wasm_bindgen]
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============================================
// TRANSPORT SYSTEM (Sample-Accurate Clock)
// ============================================

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct Transport {
    pub is_playing: bool,
    pub sample_rate: f32,
    pub bpm: f32,
    pub current_sample: u64, // Absolute sample position
    pub ppq: u32,            // Pulses per quarter note (usually 96)
    
    // Derived values for quick calculation
    samples_per_beat: f32,
    samples_per_tick: f32,

    // Loop support
    pub loop_enabled: bool,
    pub loop_start_tick: f32,
    pub loop_end_tick: f32,
}

#[wasm_bindgen]
impl Transport {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Transport {
        let mut t = Transport {
            is_playing: false,
            sample_rate,
            bpm: 120.0,
            current_sample: 0,
            ppq: 96,
            samples_per_beat: 0.0,
            samples_per_tick: 0.0,
            loop_enabled: false,
            loop_start_tick: 0.0,
            loop_end_tick: 0.0,
        };
        t.recalculate_timing();
        t
    }

    pub fn set_bpm(&mut self, bpm: f32) {
        if bpm > 0.0 {
            self.bpm = bpm;
            self.recalculate_timing();
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        if sample_rate > 0.0 {
            self.sample_rate = sample_rate;
            self.recalculate_timing();
        }
    }

    pub fn play(&mut self) {
        self.is_playing = true;
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.current_sample = 0;
    }

    pub fn pause(&mut self) {
        self.is_playing = false;
    }

    /// Advance time by N samples with Looping support
    pub fn advance(&mut self, samples: u64) {
        if self.is_playing {
            self.current_sample += samples;

            // Check Loop
            if self.loop_enabled && self.loop_end_tick > self.loop_start_tick {
                let loop_end_sample = (self.loop_end_tick * self.samples_per_tick) as u64;
                
                if self.current_sample >= loop_end_sample {
                     let loop_start_sample = (self.loop_start_tick * self.samples_per_tick) as u64;
                     let loop_len = loop_end_sample - loop_start_sample;
                     if loop_len > 0 {
                         // Wrap carefully
                         let overshoot = self.current_sample - loop_end_sample;
                         self.current_sample = loop_start_sample + (overshoot % loop_len);
                         worker_log(&format!(
                             "🔁 Loop wrap: {} -> {} (start={}, end={}, overshoot={})",
                             loop_end_sample, self.current_sample, loop_start_sample, loop_end_sample, overshoot
                         ));
                     }
                }
            }
        }
    }

    pub fn set_loop(&mut self, enabled: bool, start_tick: f32, end_tick: f32) {
        self.loop_enabled = enabled;
        self.loop_start_tick = start_tick;
        self.loop_end_tick = end_tick;
    }

    /// Set absolute position (seek)
    pub fn set_position_samples(&mut self, samples: u64) {
        self.current_sample = samples;
    }

    // --- Queries ---

    pub fn get_current_time(&self) -> f64 {
        self.current_sample as f64 / self.sample_rate as f64
    }

    pub fn get_current_beat(&self) -> f64 {
        self.current_sample as f64 / self.samples_per_beat as f64
    }

    pub fn get_current_tick(&self) -> f64 {
        self.current_sample as f64 / self.samples_per_tick as f64
    }

    // --- Internals ---

    fn recalculate_timing(&mut self) {
        // Samples per minute = sample_rate * 60
        // Samples per beat = (sample_rate * 60) / bpm
        self.samples_per_beat = (self.sample_rate * 60.0) / self.bpm;
        self.samples_per_tick = self.samples_per_beat / self.ppq as f32;
    }
}

// ============================================
// SHARED MEMORY STATE (SAB Layout)
// ============================================

// SAB Layout (Int32Array / Float32Array views)
// We use a single buffer, but interpret parts as Int32 (State) and Float32 (Params)
// Index 0-15: Control Flags (Int32)
// Index 16-31: Parameters (Float32)

#[wasm_bindgen]
pub struct SharedAudioState;

#[wasm_bindgen]
impl SharedAudioState {
    // --- Int32 Indices ---
    pub fn idx_play_state() -> usize { 0 }       // 0: Stop, 1: Play, 2: Pause
    pub fn idx_msg_counter() -> usize { 1 }      // Increment to signal new command
    pub fn idx_seek_trigger() -> usize { 2 }     // 1 = Seek Requested
    
    // --- Float32 Indices ---
    pub fn idx_bpm() -> usize { 16 }             // Tempo
    pub fn idx_position_samples() -> usize { 17 } // Current Position in Samples (High precision handled via u64 in Transport, but sync via float for UI)
    pub fn idx_position_ticks() -> usize { 18 }   // Current Position in Ticks
    pub fn idx_sample_rate() -> usize { 19 } 
    pub fn idx_seek_target() -> usize { 20 }      // Target position in Ticks (Float32)
    
    // Loop Params
    pub fn idx_loop_enabled() -> usize { 21 }     // 1.0 = true
    pub fn idx_loop_start() -> usize { 22 }       // Ticks
    pub fn idx_loop_end() -> usize { 23 }         // Ticks
}

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
        pan: f32,
        mono: bool,
        threshold: f32,
        ratio: f32,
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());

        // Pre-calculate pan coefficients
        let mut pan_gain_l = 1.0;
        let mut pan_gain_r = 1.0;
        if pan != 0.0 {
            let p = pan.clamp(-1.0, 1.0);
            pan_gain_l = ((p + 1.0) * std::f32::consts::PI / 4.0).cos();
            pan_gain_r = ((p + 1.0) * std::f32::consts::PI / 4.0).sin();
        }

        // SIMD fast path: when no EQ/Comp, no pan, no mono - just apply gain
        let can_use_simd = !eq_active && !comp_active && pan == 0.0 && !mono;
        
        if can_use_simd {
            // Process 4 samples at a time using SIMD
            let simd_len = (len / 4) * 4;
            
            for i in (0..simd_len).step_by(4) {
                let chunk_l = [input_l[i], input_l[i+1], input_l[i+2], input_l[i+3]];
                let chunk_r = [input_r[i], input_r[i+1], input_r[i+2], input_r[i+3]];
                
                let result_l = crate::simd_ops::simd_gain_4(&chunk_l, gain);
                let result_r = crate::simd_ops::simd_gain_4(&chunk_r, gain);
                
                output_l[i] = result_l[0];
                output_l[i+1] = result_l[1];
                output_l[i+2] = result_l[2];
                output_l[i+3] = result_l[3];
                
                output_r[i] = result_r[0];
                output_r[i+1] = result_r[1];
                output_r[i+2] = result_r[2];
                output_r[i+3] = result_r[3];
            }
            
            // Handle remaining samples (scalar)
            for i in simd_len..len {
                output_l[i] = input_l[i] * gain;
                output_r[i] = input_r[i] * gain;
            }
        } else {
            // Scalar path with full processing
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

                // Pan
                if pan != 0.0 {
                    let mono_sum = (sample_l + sample_r) * 0.5;
                    sample_l = mono_sum * pan_gain_l;
                    sample_r = mono_sum * pan_gain_r;
                }

                // Mono
                if mono {
                    let mono_sum = (sample_l + sample_r) * 0.5;
                    sample_l = mono_sum;
                    sample_r = mono_sum;
                }

                output_l[i] = sample_l;
                output_r[i] = sample_r;
            }
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

// ============================================
// CHANNEL STRIP (Single mixer channel DSP)
// ============================================

struct ChannelStrip {
    eq_l: ThreeBandEQ,
    eq_r: ThreeBandEQ,
    comp_gain: f32,
    comp_threshold_linear: f32,

    // Channel parameters
    gain: f32,
    pan: f32,      // -1.0 (left) to +1.0 (right)
    mute: bool,
    solo: bool,

    // EQ/Comp enable
    eq_active: bool,
    comp_active: bool,

    // Compression parameters (configurable)
    comp_threshold: f32,  // in dB
    comp_ratio: f32,

    // Dynamic Inserts
    inserts: Vec<Box<dyn AudioNode + Send>>,

    // Scratch buffers for effect processing
    temp_l: Vec<f32>,
    temp_r: Vec<f32>,

    // Metering
    peak_l: f32,
    peak_r: f32,
}

impl ChannelStrip {
    fn new(sample_rate: f32) -> ChannelStrip {
        ChannelStrip {
            eq_l: ThreeBandEQ::new(sample_rate),
            eq_r: ThreeBandEQ::new(sample_rate),
            comp_gain: 1.0,
            comp_threshold_linear: 1.0,
            gain: 1.0,
            pan: 0.0,
            mute: false,
            solo: false,
            eq_active: false,
            comp_active: false,
            comp_threshold: -12.0,  // Default: -12dB
            comp_ratio: 4.0,        // Default: 4:1
            inserts: Vec::new(),
            temp_l: vec![0.0; 1024], // Pre-allocate enough for standard block size
            temp_r: vec![0.0; 1024],
            peak_l: 0.0,
            peak_r: 0.0,
        }
    }

    /// Process stereo block through channel strip
    fn process_block(
        &mut self, 
        input_l: &[f32], 
        input_r: &[f32], 
        output_l: &mut [f32], 
        output_r: &mut [f32], 
        sample_rate: f32
    ) {
        if self.mute {
            for x in output_l.iter_mut() { *x = 0.0; }
            for x in output_r.iter_mut() { *x = 0.0; }
            return;
        }

        // Copy input to output (start point)
        // Note: we assume output_l/r are sized correctly
        let len = output_l.len().min(input_l.len());
        for i in 0..len {
            output_l[i] = input_l[i];
            output_r[i] = input_r[i];
        }

        // 0. Inserts (Dynamic Routing)
        if !self.inserts.is_empty() {
            // Resize temp buffers if needed
            if self.temp_l.len() < len { self.temp_l.resize(len, 0.0); }
            if self.temp_r.len() < len { self.temp_r.resize(len, 0.0); }

            for (_i, _insert) in self.inserts.iter_mut().enumerate() {
                 // BYPASS INSERTS AS REQUESTED BY USER
                 /*
                 // Input is current output
                 let inputs = [&output_l[0..len], &output_r[0..len]];
                 
                 {
                     let mut outputs = [&mut self.temp_l[0..len], &mut self.temp_r[0..len]];
                     insert.process(&inputs, &mut outputs);
                 }
                 
                 // Copy result back to output_l/r
                 output_l[0..len].copy_from_slice(&self.temp_l[0..len]);
                 output_r[0..len].copy_from_slice(&self.temp_r[0..len]);
                 */
            }
        }

        // 1. EQ
        if self.eq_active {
            for i in 0..len {
                output_l[i] = self.eq_l.process(output_l[i]);
                output_r[i] = self.eq_r.process(output_r[i]);
            }
        }

        // 2. Compression
        if self.comp_active {
            for i in 0..len {
                let l = output_l[i];
                let r = output_r[i];
                let gain_reduction = self.process_compression(l, r, self.comp_threshold, self.comp_ratio, sample_rate);
                output_l[i] *= gain_reduction;
                output_r[i] *= gain_reduction;
            }
        }

        // 3. Gain & Pan
        let mut pan_gain_l = 1.0;
        let mut pan_gain_r = 1.0;
        if self.pan != 0.0 {
            let p_norm = (self.pan + 1.0) * 0.25 * std::f32::consts::PI;
            pan_gain_l = p_norm.cos();
            pan_gain_r = p_norm.sin();
            
            if self.pan > 0.0 {
                 pan_gain_l *= 1.0 - self.pan;
            } else {
                 pan_gain_r *= 1.0 + self.pan;
            }
        }
        
        let combined_gain = self.gain;
        let final_gain_l = combined_gain * pan_gain_l;
        let final_gain_r = combined_gain * pan_gain_r;
        
        // Calculate Peaks for Metering
        let mut max_l: f32 = 0.0;
        let mut max_r: f32 = 0.0;
        
        for i in 0..len {
            output_l[i] *= final_gain_l;
            output_r[i] *= final_gain_r;
            
            let abs_l = output_l[i].abs();
            let abs_r = output_r[i].abs();
            if abs_l > max_l { max_l = abs_l; }
            if abs_r > max_r { max_r = abs_r; }
        }
        
        // Store recent peak (decay logic can be done in JS, here we capture block peak)
        self.peak_l = max_l;
        self.peak_r = max_r;
    }

    /// Process compression (same as WasmAudioProcessor)
    #[inline]
    fn process_compression(&mut self, left: f32, right: f32, threshold: f32, ratio: f32, sample_rate: f32) -> f32 {
        let input_level = left.abs().max(right.abs());

        if input_level < 0.001 || threshold >= 0.0 {
            self.comp_gain += (1.0 - self.comp_gain) * 0.003;
            return self.comp_gain;
        }

        self.comp_threshold_linear = 10.0_f32.powf(threshold / 20.0);

        let mut target_gain = 1.0;
        if input_level > self.comp_threshold_linear {
            let excess = (input_level - self.comp_threshold_linear) / self.comp_threshold_linear;
            let reduction = excess / ratio;
            target_gain = 1.0 / (1.0 + reduction);
        }

        let time_constant = if target_gain < self.comp_gain { 0.003 } else { 0.1 };
        let smoothing_factor = 1.0 - (-1.0 / (time_constant * sample_rate)).exp();

        self.comp_gain += (target_gain - self.comp_gain) * smoothing_factor;
        self.comp_gain
    }

    fn reset(&mut self) {
        self.eq_l.reset();
        self.eq_r.reset();
        self.comp_gain = 1.0;
    }
}

#[wasm_bindgen]
pub fn allocate_f32_array(size: usize) -> *mut f32 {
    let mut vec = Vec::with_capacity(size);
    let ptr = vec.as_mut_ptr();
    std::mem::forget(vec); // Prevent deallocation
    ptr
}

// ============================================
// UNIFIED MIXER PROCESSOR (MegaMixer)
// ============================================

#[wasm_bindgen]
pub struct UnifiedMixerProcessor {
    channels: Vec<ChannelStrip>,
    sample_rate: f32,
    
    // ✅ NEW: Sample-Accurate Transport
    transport: Transport,
    
    // ✅ NEW: Shared State Pointer (SAB)
    shared_state_ptr: *mut f32,

    // Global master compression
    master_comp_gain: f32,
    master_comp_threshold_linear: f32,

    // Solo state tracking
    any_solo_active: bool,
    
    // Pre-allocated temp buffers (prevent allocation in hot path)
    temp_l: Vec<f32>,
    temp_r: Vec<f32>,
    in_l: Vec<f32>,
    in_r: Vec<f32>,
}

#[wasm_bindgen]
impl UnifiedMixerProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, num_channels: usize) -> UnifiedMixerProcessor {
        let mut channels = Vec::with_capacity(num_channels);
        for _ in 0..num_channels {
            channels.push(ChannelStrip::new(sample_rate));
        }

        UnifiedMixerProcessor {
            channels,
            sample_rate,
            transport: Transport::new(sample_rate), // ✅ Initialize Transport
            shared_state_ptr: std::ptr::null_mut(), // ✅ Initialize null pointer
            master_comp_gain: 1.0,
            master_comp_threshold_linear: 1.0,
            any_solo_active: false,
            // Pre-allocate temp buffers (128 samples max)
            temp_l: vec![0.0; 128],
            temp_r: vec![0.0; 128],
            in_l: vec![0.0; 128],
            in_r: vec![0.0; 128],
        }
    }

    /// Set the shared state buffer pointer (SAB)
    pub fn set_shared_state_buffer(&mut self, ptr: *mut f32) {
        self.shared_state_ptr = ptr;
    }

    /// Sync Transport state with Shared Array Buffer
    /// Reads commands (int) and params (float). Writes position.
    fn sync_state(&mut self) {
        if self.shared_state_ptr.is_null() { return; }

        unsafe {
            // Re-interpret pointer for mixed Int/Float access
            let int_view = self.shared_state_ptr as *mut i32;
            let float_view = self.shared_state_ptr;

            // --- READ FROM JS (Commands) ---
            // Check play state (Index 0)
            let play_state = *int_view.add(SharedAudioState::idx_play_state());
            match play_state {
                0 => { if self.transport.is_playing { self.transport.stop(); } },
                1 => { if !self.transport.is_playing { self.transport.play(); } },
                2 => { if self.transport.is_playing { self.transport.pause(); } },
                _ => {}
            }

            // Check BPM (Index 16)
            let bpm = *float_view.add(SharedAudioState::idx_bpm());
            if bpm > 0.0 && (bpm - self.transport.bpm).abs() > 0.001 {
                self.transport.set_bpm(bpm);
            }
            
            // --- READ FROM JS (Seek Command) ---
            // Check Seek Trigger (Index 2)
            let seek_trigger_ptr = int_view.add(SharedAudioState::idx_seek_trigger());
            let seek_trigger = *seek_trigger_ptr;
            if seek_trigger == 1 {
                // Read Target (Index 20)
                let target_ticks = *float_view.add(SharedAudioState::idx_seek_target());
                if target_ticks >= 0.0 {
                     // Convert ticks to samples
                     let target_samples = (target_ticks * self.transport.samples_per_tick) as u64;
                     self.transport.set_position_samples(target_samples);
                     
                     // ✅ FLUSH: Clear buffers (reverb tails, delays, filters) on seek
                     // This prevents old audio from bleeding into the new position
                     self.reset();
                }
                // Reset trigger
                *seek_trigger_ptr = 0;
            }
            
            
            // --- READ FROM JS (Loop Params) ---
            let loop_enabled = *float_view.add(SharedAudioState::idx_loop_enabled()) > 0.5;
            let loop_start = *float_view.add(SharedAudioState::idx_loop_start());
            let loop_end = *float_view.add(SharedAudioState::idx_loop_end());
            
            // 🔍 DEBUG: Log loop changes
            static mut LAST_LOOP_STATE: (bool, f32, f32) = (false, 0.0, 0.0);
            if loop_enabled != LAST_LOOP_STATE.0 || 
               loop_start != LAST_LOOP_STATE.1 || 
               loop_end != LAST_LOOP_STATE.2 {
                worker_log(&format!(
                    "🔄 WASM Loop Update: enabled={}, start={:.2}, end={:.2}",
                    loop_enabled, loop_start, loop_end
                ));
                LAST_LOOP_STATE = (loop_enabled, loop_start, loop_end);
            }
            
            self.transport.set_loop(loop_enabled, loop_start, loop_end);

            // --- WRITE TO JS (Position) ---
            // Write current position info for UI
            *float_view.add(SharedAudioState::idx_position_samples()) = self.transport.current_sample as f32;
            *float_view.add(SharedAudioState::idx_position_ticks()) = self.transport.get_current_tick() as f32;
        }
    }

    /// Process all channels and mix to stereo output
    ///
    /// # Arguments
    /// * `interleaved_inputs` - Flat array: [ch0_L_s0, ch0_R_s0, ch1_L_s0, ch1_R_s0, ..., ch0_L_s1, ch0_R_s1, ...]
    /// * `output_l` - Left channel output buffer
    #[wasm_bindgen]
    pub fn process_mix(
        &mut self,
        interleaved_ptr: *const f32,
        input_len: usize,
        out_l_ptr: *mut f32,
        out_r_ptr: *mut f32,
        block_size: usize,
    ) {
        // worker_log("PM: Raw Ptr Start");
        
        // 1. Sync State with JS (Shared Memory)
        self.sync_state();

        // SAFETY: We trust the JS caller to provide valid pointers allocated via allocate_f32_array
        let interleaved_inputs = unsafe { std::slice::from_raw_parts(interleaved_ptr, input_len) };
        let output_l = unsafe { std::slice::from_raw_parts_mut(out_l_ptr, block_size) };
        let output_r = unsafe { std::slice::from_raw_parts_mut(out_r_ptr, block_size) };

        // Zero outputs
        for x in output_l.iter_mut() { *x = 0.0; }
        for x in output_r.iter_mut() { *x = 0.0; }
        
        // worker_log("PM: Zeroed");

        let num_channels = self.channels.len();
        
        // Resize temp buffers if needed
        if self.temp_l.len() < block_size {
             self.temp_l.resize(block_size, 0.0);
             self.temp_r.resize(block_size, 0.0);
             self.in_l.resize(block_size, 0.0);
             self.in_r.resize(block_size, 0.0);
        }

        // Check global solo state
        self.any_solo_active = self.channels.iter().any(|c| c.solo);

        // Mix loop
        for (i, channel) in self.channels.iter_mut().enumerate() {
            // Check Mute/Solo logic
            if channel.mute { continue; }
            if self.any_solo_active && !channel.solo { continue; }

            // De-interleave input for this channel
            // Input format: [S0_C0_L, S0_C0_R, S0_C1_L, S0_C1_R, ...]
            // Index for Sample s, Channel c: s * num_channels * 2 + c * 2
            let mut has_signal = false;
            for s in 0..block_size {
                let idx = s * num_channels * 2 + i * 2;
                if idx + 1 < interleaved_inputs.len() {
                    let l = interleaved_inputs[idx];
                    let r = interleaved_inputs[idx+1];
                    self.in_l[s] = l;
                    self.in_r[s] = r;
                    if l.abs() > 0.0001 || r.abs() > 0.0001 { has_signal = true; }
                }
            }

            // Optimization: Skip empty channels
            if !has_signal { continue; }

            // Process Channel Strip (EQ, Comp, Gain, Pan)
            // Note: We use in_l/in_r as source and mix directly into output_l/output_r?
            // ChannelStrip process uses in-place or separate? separate.
            // Using temp_l/temp_r as destination for channel strip
            channel.process_block(
                &self.in_l[0..block_size], 
                &self.in_r[0..block_size], 
                &mut self.temp_l[0..block_size], 
                &mut self.temp_r[0..block_size], 
                self.sample_rate
            );

            // Sum to Master Bus
            for s in 0..block_size {
                output_l[s] += self.temp_l[s];
                output_r[s] += self.temp_r[s];
            }
        }

        // Master Compression / Limiting (Optional - future)
        // ...

        // 2. Advance Sample Clock
        self.transport.advance(block_size as u64);
    }

    /// Update channel parameters
    #[wasm_bindgen]
    pub fn set_channel_params(
        &mut self,
        channel_idx: usize,
        gain: f32,
        pan: f32,
        mute: bool,
        solo: bool,
        eq_active: bool,
        comp_active: bool,
    ) {
        if channel_idx < self.channels.len() {
            let channel = &mut self.channels[channel_idx];
            channel.gain = gain;
            channel.pan = pan.clamp(-1.0, 1.0);
            channel.mute = mute;
            channel.solo = solo;
            channel.eq_active = eq_active;
            channel.comp_active = comp_active;
        }
    }

    /// Update channel EQ coefficients
    #[wasm_bindgen]
    pub fn set_channel_eq(
        &mut self,
        channel_idx: usize,
        low_gain: f32,
        mid_gain: f32,
        high_gain: f32,
        low_freq: f32,
        high_freq: f32,
    ) {
        if channel_idx < self.channels.len() {
            let channel = &mut self.channels[channel_idx];
            channel.eq_l.update_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq);
            channel.eq_r.update_coefficients(low_gain, mid_gain, high_gain, low_freq, high_freq);
        }
    }

    /// Update channel compression parameters
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

    /// Reset all channels
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        for channel in &mut self.channels {
            channel.reset();
        }
        self.master_comp_gain = 1.0;
    }

    /// Get number of channels
    #[wasm_bindgen]
    pub fn get_num_channels(&self) -> usize {
        self.channels.len()
    }

    /// Add an effect to a channel
    /// 
    /// effect_type: 0 = Simple Delay
    #[wasm_bindgen]
    pub fn add_effect(&mut self, channel_idx: usize, effect_type: usize) -> Result<(), JsValue> {
        if channel_idx >= self.channels.len() { 
            return Err(JsValue::from_str("Channel index out of bounds")); 
        }
        
        let effect: Box<dyn AudioNode + Send> = match effect_type {
            0 => Box::new(crate::effects::SimpleDelay::new(self.sample_rate)),
            _ => return Err(JsValue::from_str("Unknown effect type")),
        };
        
        self.channels[channel_idx].inserts.push(effect);
        Ok(())
    }

    /// fast polling of levels
    #[wasm_bindgen]
    pub fn get_channel_levels(&mut self, levels_ptr: *mut f32, len: usize) {
        let levels = unsafe { std::slice::from_raw_parts_mut(levels_ptr, len) };
        for (i, channel) in self.channels.iter_mut().enumerate() {
            if i * 2 + 1 < len {
                levels[i * 2] = channel.peak_l;
                levels[i * 2 + 1] = channel.peak_r;
                
                // Decay happens in JS, but we reset here to capture *new* peaks next block
                channel.peak_l = 0.0;
                channel.peak_r = 0.0;
            }
        }
    }
}

