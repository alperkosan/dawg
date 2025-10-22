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
        }
    }

    /// Process stereo sample through channel strip
    #[inline]
    fn process(&mut self, sample_l: f32, sample_r: f32, _sample_rate: f32) -> (f32, f32) {
        if self.mute {
            return (0.0, 0.0);
        }

        // 🧪 COMPLETE BYPASS - Just pass through
        (sample_l, sample_r)
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

// ============================================
// UNIFIED MIXER PROCESSOR (MegaMixer)
// ============================================

#[wasm_bindgen]
pub struct UnifiedMixerProcessor {
    channels: Vec<ChannelStrip>,
    sample_rate: f32,

    // Global master compression
    master_comp_gain: f32,
    master_comp_threshold_linear: f32,

    // Solo state tracking
    any_solo_active: bool,
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
            master_comp_gain: 1.0,
            master_comp_threshold_linear: 1.0,
            any_solo_active: false,
        }
    }

    /// Process all channels and mix to stereo output
    ///
    /// # Arguments
    /// * `interleaved_inputs` - Flat array: [ch0_L_s0, ch0_R_s0, ch1_L_s0, ch1_R_s0, ..., ch0_L_s1, ch0_R_s1, ...]
    /// * `output_l` - Left channel output buffer
    /// * `output_r` - Right channel output buffer
    /// * `block_size` - Number of samples per block
    /// * `num_channels` - Number of input channels
    #[wasm_bindgen]
    pub fn process_mix(
        &mut self,
        interleaved_inputs: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
        block_size: usize,
        num_channels: usize,
    ) {
        // 🧪 MINIMAL TEST: Match JavaScript exactly
        // Clear output
        for i in 0..block_size {
            output_l[i] = 0.0;
            output_r[i] = 0.0;
        }

        // Simple sum - no solo/mute, no channel processing, just raw sum
        for sample_idx in 0..block_size {
            for ch_idx in 0..num_channels {
                // Calculate input index: sample_idx * num_channels * 2 + ch_idx * 2
                let input_base_idx = sample_idx * num_channels * 2 + ch_idx * 2;

                if input_base_idx + 1 < interleaved_inputs.len() {
                    let in_l = interleaved_inputs[input_base_idx];
                    let in_r = interleaved_inputs[input_base_idx + 1];

                    // Direct sum - exactly like JavaScript
                    output_l[sample_idx] += in_l;
                    output_r[sample_idx] += in_r;
                }
            }
        }
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
}
