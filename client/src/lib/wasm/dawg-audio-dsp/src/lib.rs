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
// ============================================
// DELAY LINE (Circular Buffer)
// ============================================

struct DelayLine {
    buffer: Vec<f32>,
    index: usize,
}

impl DelayLine {
    fn new(size: usize) -> DelayLine {
        DelayLine {
            buffer: vec![0.0; size],
            index: 0,
        }
    }

    fn read(&self) -> f32 {
        self.buffer[self.index]
    }

    fn read_at(&self, offset: usize) -> f32 {
        let idx = (self.index + self.buffer.len() - offset) % self.buffer.len();
        self.buffer[idx]
    }

    // Linear interpolation read
    fn read_interpolated(&self, delay_samples: f32) -> f32 {
        let delay_int = delay_samples.floor() as usize;
        let delay_frac = delay_samples - delay_int as f32;

        let idx1 = (self.index + self.buffer.len() - delay_int) % self.buffer.len();
        let idx2 = (self.index + self.buffer.len() - delay_int - 1) % self.buffer.len();

        let s1 = self.buffer[idx1];
        let s2 = self.buffer[idx2];

        s1 + (s2 - s1) * delay_frac
    }

    fn write(&mut self, value: f32) {
        self.buffer[self.index] = value;
        self.index = (self.index + 1) % self.buffer.len();
    }

    fn reset(&mut self) {
        for x in &mut self.buffer {
            *x = 0.0;
        }
        self.index = 0;
    }
}

// ============================================
// REVERB COMPONENTS
// ============================================

struct CombFilter {
    delay: DelayLine,
    filter_state: f32,
    filter_state2: f32, // Second pole
    base_size: usize,
}

impl CombFilter {
    fn new(size: usize) -> CombFilter {
        CombFilter {
            delay: DelayLine::new(size),
            filter_state: 0.0,
            filter_state2: 0.0,
            base_size: size,
        }
    }

    fn process(&mut self, input: f32, feedback: f32, damp1: f32, damp2: f32) -> f32 {
        let output = self.delay.read();

        // Two-pole damping
        self.filter_state = output + damp1 * (self.filter_state - output);
        self.filter_state2 = self.filter_state + damp2 * (self.filter_state2 - self.filter_state);
        
        let filtered = self.filter_state2;
        
        // Feedback
        let new_input = input + filtered * feedback;
        
        // Safety check
        let safe_input = if new_input.is_finite() { new_input } else { 0.0 };
        
        self.delay.write(safe_input);
        
        output
    }
    
    // Process with modulation
    fn process_modulated(&mut self, input: f32, feedback: f32, damp1: f32, damp2: f32, mod_delay: f32) -> f32 {
        // Modulated read
        let output = self.delay.read_interpolated(mod_delay);

        // Two-pole damping
        self.filter_state = output + damp1 * (self.filter_state - output);
        self.filter_state2 = self.filter_state + damp2 * (self.filter_state2 - self.filter_state);
        
        let filtered = self.filter_state2;
        
        // Feedback
        let new_input = input + filtered * feedback;
        
        // Safety check
        let safe_input = if new_input.is_finite() { new_input } else { 0.0 };
        
        self.delay.write(safe_input);
        
        output
    }

    fn reset(&mut self) {
        self.delay.reset();
        self.filter_state = 0.0;
        self.filter_state2 = 0.0;
    }
}

struct AllpassFilter {
    delay: DelayLine,
}

impl AllpassFilter {
    fn new(size: usize) -> AllpassFilter {
        AllpassFilter {
            delay: DelayLine::new(size),
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let delayed = self.delay.read();
        let output = -input + delayed;
        let feedback = input + delayed * 0.5;
        
        self.delay.write(feedback);
        
        output
    }

    fn reset(&mut self) {
        self.delay.reset();
    }
}

// ============================================
// REVERB PROCESSOR
// ============================================

#[wasm_bindgen]
pub struct ReverbProcessor {
    sample_rate: f32,
    
    // Components
    combs_l: Vec<CombFilter>,
    combs_r: Vec<CombFilter>,
    allpass_l: Vec<AllpassFilter>,
    allpass_r: Vec<AllpassFilter>,
    
    // Pre-delay
    pre_delay: DelayLine,
    
    // Early reflections
    early_delays: Vec<usize>,
    early_gains: Vec<f32>,
    early_buffer: DelayLine,
    
    // LFO
    lfo_phase: f32,
}

#[wasm_bindgen]
impl ReverbProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> ReverbProcessor {
        let scale = sample_rate / 44100.0;
        
        // Tunings
        let comb_tunings = [1557, 1617, 1491, 1422];
        let allpass_tunings = [225, 341, 441, 556];
        let stereo_spread = 23;
        
        // Initialize Combs
        let mut combs_l = Vec::new();
        let mut combs_r = Vec::new();
        
        for &t in &comb_tunings {
            let size_l = (t as f32 * scale) as usize;
            let size_r = ((t + stereo_spread) as f32 * scale) as usize;
            // Add extra buffer for modulation
            combs_l.push(CombFilter::new(size_l + 100)); 
            combs_r.push(CombFilter::new(size_r + 100));
        }
        
        // Initialize Allpass
        let mut allpass_l = Vec::new();
        let mut allpass_r = Vec::new();
        
        for &t in &allpass_tunings {
            let size = (t as f32 * scale) as usize;
            allpass_l.push(AllpassFilter::new(size));
            allpass_r.push(AllpassFilter::new(size));
        }
        
        // Pre-delay (max 0.5s)
        let pre_delay_size = (sample_rate * 0.5) as usize;
        
        // Early reflections
        let early_times = [5, 11, 17, 23, 31, 37, 43, 47, 53, 59, 67, 73]; // ms
        let early_delays: Vec<usize> = early_times.iter()
            .map(|&ms| (ms as f32 / 1000.0 * sample_rate) as usize)
            .collect();
            
        let early_gains: Vec<f32> = early_times.iter()
            .map(|&ms| (-ms as f32 / 80.0).exp()) // Decay curve
            .collect();
            
        let early_buffer_size = (0.1 * sample_rate) as usize; // 100ms max for early
        
        ReverbProcessor {
            sample_rate,
            combs_l,
            combs_r,
            allpass_l,
            allpass_r,
            pre_delay: DelayLine::new(pre_delay_size),
            early_delays,
            early_gains,
            early_buffer: DelayLine::new(early_buffer_size),
            lfo_phase: 0.0,
        }
    }
    
    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
        size: f32,
        decay: f32,
        damping: f32,
        pre_delay_time: f32,
        wet: f32,
        early_late_mix: f32,
        width: f32,
        mod_depth: f32,
        mod_rate: f32,
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        
        // Calculate coefficients
        let avg_comb_delay = 1400.0 * (self.sample_rate / 44100.0);
        let feedback = 10.0_f32.powf(-3.0 * avg_comb_delay / (decay * self.sample_rate)).min(0.999);
        
        let damp_freq = 2000.0 + (1.0 - damping) * 18000.0;
        let omega = 2.0 * std::f32::consts::PI * damp_freq / self.sample_rate;
        let damp1 = (-omega).exp();
        let damp2 = (-omega * 1.5).exp();
        
        let pre_delay_samples = (pre_delay_time * self.sample_rate) as usize;
        
        let lfo_inc = 2.0 * std::f32::consts::PI * mod_rate / self.sample_rate;
        
        for i in 0..len {
            // Update LFO
            self.lfo_phase += lfo_inc;
            if self.lfo_phase > 2.0 * std::f32::consts::PI {
                self.lfo_phase -= 2.0 * std::f32::consts::PI;
            }
            
            let in_mono = (input_l[i] + input_r[i]) * 0.5;
            
            // Pre-delay
            self.pre_delay.write(in_mono);
            let delayed = self.pre_delay.read_at(pre_delay_samples);
            
            // Early Reflections
            self.early_buffer.write(delayed);
            let mut early_sum = 0.0;
            for j in 0..self.early_delays.len() {
                early_sum += self.early_buffer.read_at(self.early_delays[j]) * self.early_gains[j];
            }
            
            // Late Reverb (Combs)
            let mut comb_sum_l = 0.0;
            let mut comb_sum_r = 0.0;
            
            for j in 0..4 {
                // Modulated delay for chorus effect
                let phase_offset = j as f32 * std::f32::consts::PI / 4.0;
                let lfo = (self.lfo_phase + phase_offset).sin();
                
                let base_size_l = self.combs_l[j].base_size as f32 * (0.5 + size * 1.5);
                let base_size_r = self.combs_r[j].base_size as f32 * (0.5 + size * 1.5);
                
                let mod_amount = mod_depth * 0.05 * base_size_l; // +/- 5%
                
                let delay_l = base_size_l + lfo * mod_amount;
                let delay_r = base_size_r + lfo * mod_amount; // Sync LFO for now, could offset
                
                comb_sum_l += self.combs_l[j].process_modulated(delayed, feedback, damp1, damp2, delay_l);
                comb_sum_r += self.combs_r[j].process_modulated(delayed, feedback, damp1, damp2, delay_r);
            }
            
            comb_sum_l *= 0.25;
            comb_sum_r *= 0.25;
            
            // Allpass Diffusion
            let mut late_l = comb_sum_l;
            let mut late_r = comb_sum_r;
            
            for j in 0..4 {
                late_l = self.allpass_l[j].process(late_l);
                late_r = self.allpass_r[j].process(late_r);
            }
            
            // Mix Early/Late
            let mut reverb_l = early_sum * (1.0 - early_late_mix) + late_l * early_late_mix;
            let mut reverb_r = early_sum * (1.0 - early_late_mix) + late_r * early_late_mix;
            
            // Stereo Width (Mid/Side)
            let mid = (reverb_l + reverb_r) * 0.5;
            let side = (reverb_l - reverb_r) * 0.5;
            reverb_l = mid + side * width;
            reverb_r = mid - side * width;
            
            // Output Mix
            output_l[i] = input_l[i] * (1.0 - wet) + reverb_l * wet * 0.5;
            output_r[i] = input_r[i] * (1.0 - wet) + reverb_r * wet * 0.5;
        }
    }
    
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        for c in &mut self.combs_l { c.reset(); }
        for c in &mut self.combs_r { c.reset(); }
        for a in &mut self.allpass_l { a.reset(); }
        for a in &mut self.allpass_r { a.reset(); }
        self.pre_delay.reset();
        self.early_buffer.reset();
    }
}
