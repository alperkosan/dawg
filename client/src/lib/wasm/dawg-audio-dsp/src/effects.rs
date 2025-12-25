use wasm_bindgen::prelude::*;
use crate::graph::AudioNode;
use crate::filters::{DelayLine, CombFilter, AllpassFilter};

// ============================================
// SIMPLE DELAY EFFECT
// ============================================

#[wasm_bindgen]
pub struct SimpleDelay {
    delays: Vec<DelayLine>,
    delay_samples: f32,
    feedback: f32,
    mix: f32, // 0.0 to 1.0 (dry/wet)
    sample_rate: f32,
}

#[wasm_bindgen]
impl SimpleDelay {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> SimpleDelay {
        // Initialize 2 channels (Stereo)
        let mut delays = Vec::new();
        delays.push(DelayLine::new((sample_rate * 2.0) as usize));
        delays.push(DelayLine::new((sample_rate * 2.0) as usize));

        SimpleDelay {
            delays,
            delay_samples: sample_rate * 0.5, // 500ms
            feedback: 0.7, // Aggressive feedback for testing
            mix: 0.8, // Mostly Wet
            sample_rate,
        }
    }

    pub fn set_time(&mut self, seconds: f32) {
        self.delay_samples = (seconds * self.sample_rate).max(1.0);
    }

    pub fn set_feedback(&mut self, val: f32) {
        self.feedback = val.clamp(0.0, 0.95);
    }

    pub fn set_mix(&mut self, val: f32) {
        self.mix = val.clamp(0.0, 1.0);
    }
}

impl AudioNode for SimpleDelay {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]]) {
        // Assume inputs[0]=L, inputs[1]=R (or mono)
        let num_channels = inputs.len().min(outputs.len()).min(self.delays.len());
        
        for ch in 0..num_channels {
            let src = inputs[ch];
            let dst = &mut outputs[ch];
            let delay_line = &mut self.delays[ch];
            
            for i in 0..src.len() {
                let input = src[i];
                let delayed = delay_line.read_interpolated(self.delay_samples);
                
                // Feedback loop
                let next_in = input + delayed * self.feedback;
                delay_line.write(next_in);
                
                // Output Mix
                dst[i] = input * (1.0 - self.mix) + delayed * self.mix;
            }
        }
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

// ============================================
// COMPRESSOR
// ============================================

#[wasm_bindgen]
pub struct Compressor {
    sample_rate: f32,
    threshold: f32,    // dB (-60 to 0)
    ratio: f32,        // 1:1 to 20:1
    attack: f32,       // seconds
    release: f32,      // seconds
    knee: f32,         // dB (0 = hard knee)
    makeup_gain: f32,  // dB
    
    // State
    envelope: f32,
    gain_reduction: f32,
}

#[wasm_bindgen]
impl Compressor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Compressor {
        Compressor {
            sample_rate,
            threshold: -18.0,
            ratio: 4.0,
            attack: 0.01,
            release: 0.1,
            knee: 6.0,
            makeup_gain: 0.0,
            envelope: 0.0,
            gain_reduction: 1.0,
        }
    }

    pub fn set_threshold(&mut self, db: f32) {
        self.threshold = db.clamp(-60.0, 0.0);
    }

    pub fn set_ratio(&mut self, ratio: f32) {
        self.ratio = ratio.clamp(1.0, 20.0);
    }

    pub fn set_attack(&mut self, seconds: f32) {
        self.attack = seconds.clamp(0.0001, 1.0);
    }

    pub fn set_release(&mut self, seconds: f32) {
        self.release = seconds.clamp(0.01, 5.0);
    }

    pub fn set_knee(&mut self, db: f32) {
        self.knee = db.clamp(0.0, 24.0);
    }

    pub fn set_makeup_gain(&mut self, db: f32) {
        self.makeup_gain = db.clamp(0.0, 24.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        
        let attack_coef = (-1.0 / (self.attack * self.sample_rate)).exp();
        let release_coef = (-1.0 / (self.release * self.sample_rate)).exp();
        let threshold_linear = 10.0_f32.powf(self.threshold / 20.0);
        let makeup_linear = 10.0_f32.powf(self.makeup_gain / 20.0);
        let knee_half = self.knee / 2.0;

        for i in 0..len {
            // Peak detection
            let peak = input_l[i].abs().max(input_r[i].abs());
            
            // Envelope follower
            let coef = if peak > self.envelope { attack_coef } else { release_coef };
            self.envelope = coef * self.envelope + (1.0 - coef) * peak;
            
            // Gain calculation with soft knee
            let db_over = 20.0 * (self.envelope / threshold_linear).log10();
            
            let gain_db = if db_over <= -knee_half {
                0.0
            } else if db_over >= knee_half {
                db_over * (1.0 - 1.0 / self.ratio)
            } else {
                // Soft knee
                let knee_factor = (db_over + knee_half) / self.knee;
                db_over * (1.0 - 1.0 / self.ratio) * knee_factor * knee_factor
            };
            
            self.gain_reduction = 10.0_f32.powf(-gain_db / 20.0);
            
            // Apply gain reduction and makeup
            let final_gain = self.gain_reduction * makeup_linear;
            output_l[i] = input_l[i] * final_gain;
            output_r[i] = input_r[i] * final_gain;
        }
    }

    pub fn reset(&mut self) {
        self.envelope = 0.0;
        self.gain_reduction = 1.0;
    }
}

// ============================================
// SATURATOR (Tape/Tube Saturation)
// ============================================

#[wasm_bindgen]
pub struct Saturator {
    drive: f32,        // 0.0 to 1.0
    mix: f32,          // dry/wet
    mode: u32,         // 0=tape, 1=tube, 2=hard
    output_gain: f32,
}

#[wasm_bindgen]
impl Saturator {
    #[wasm_bindgen(constructor)]
    pub fn new(_sample_rate: f32) -> Saturator {
        Saturator {
            drive: 0.5,
            mix: 1.0,
            mode: 0,
            output_gain: 1.0,
        }
    }

    pub fn set_drive(&mut self, val: f32) {
        self.drive = val.clamp(0.0, 1.0);
    }

    pub fn set_mix(&mut self, val: f32) {
        self.mix = val.clamp(0.0, 1.0);
    }

    pub fn set_mode(&mut self, mode: u32) {
        self.mode = mode.min(2);
    }

    pub fn set_output_gain(&mut self, db: f32) {
        self.output_gain = 10.0_f32.powf(db.clamp(-12.0, 12.0) / 20.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        let drive_amount = 1.0 + self.drive * 10.0;

        for i in 0..len {
            let dry_l = input_l[i];
            let dry_r = input_r[i];
            
            let driven_l = dry_l * drive_amount;
            let driven_r = dry_r * drive_amount;
            
            let sat_l = match self.mode {
                0 => self.tape_saturate(driven_l),
                1 => self.tube_saturate(driven_l),
                _ => self.hard_clip(driven_l),
            };
            
            let sat_r = match self.mode {
                0 => self.tape_saturate(driven_r),
                1 => self.tube_saturate(driven_r),
                _ => self.hard_clip(driven_r),
            };
            
            output_l[i] = (dry_l * (1.0 - self.mix) + sat_l * self.mix) * self.output_gain;
            output_r[i] = (dry_r * (1.0 - self.mix) + sat_r * self.mix) * self.output_gain;
        }
    }

    fn tape_saturate(&self, x: f32) -> f32 {
        // Soft saturation (tanh approximation)
        let x2 = x * x;
        x * (27.0 + x2) / (27.0 + 9.0 * x2)
    }

    fn tube_saturate(&self, x: f32) -> f32 {
        // Asymmetric tube-style saturation
        if x >= 0.0 {
            1.0 - (-x).exp()
        } else {
            -1.0 + x.exp()
        }
    }

    fn hard_clip(&self, x: f32) -> f32 {
        x.clamp(-1.0, 1.0)
    }
}

// ============================================
// LIMITER (Brickwall)
// ============================================

#[wasm_bindgen]
pub struct Limiter {
    sample_rate: f32,
    threshold: f32,
    release: f32,
    ceiling: f32,
    
    // State
    envelope: f32,
}

#[wasm_bindgen]
impl Limiter {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Limiter {
        Limiter {
            sample_rate,
            threshold: -1.0,
            release: 0.1,
            ceiling: -0.3,
            envelope: 0.0,
        }
    }

    pub fn set_threshold(&mut self, db: f32) {
        self.threshold = db.clamp(-20.0, 0.0);
    }

    pub fn set_release(&mut self, seconds: f32) {
        self.release = seconds.clamp(0.01, 1.0);
    }

    pub fn set_ceiling(&mut self, db: f32) {
        self.ceiling = db.clamp(-6.0, 0.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        
        let threshold_lin = 10.0_f32.powf(self.threshold / 20.0);
        let ceiling_lin = 10.0_f32.powf(self.ceiling / 20.0);
        let release_coef = (-1.0 / (self.release * self.sample_rate)).exp();

        for i in 0..len {
            let peak = input_l[i].abs().max(input_r[i].abs());
            
            // Instant attack, slow release envelope
            if peak > self.envelope {
                self.envelope = peak;
            } else {
                self.envelope = release_coef * self.envelope + (1.0 - release_coef) * peak;
            }
            
            // Calculate gain reduction
            let gain = if self.envelope > threshold_lin {
                threshold_lin / self.envelope
            } else {
                1.0
            };
            
            // Apply gain and ceiling
            output_l[i] = (input_l[i] * gain).clamp(-ceiling_lin, ceiling_lin);
            output_r[i] = (input_r[i] * gain).clamp(-ceiling_lin, ceiling_lin);
        }
    }

    pub fn reset(&mut self) {
        self.envelope = 0.0;
    }
}

// ============================================
// CLIPPER (Soft/Hard Clip)
// ============================================

#[wasm_bindgen]
pub struct Clipper {
    threshold: f32,
    softness: f32,  // 0 = hard, 1 = soft
}

#[wasm_bindgen]
impl Clipper {
    #[wasm_bindgen(constructor)]
    pub fn new(_sample_rate: f32) -> Clipper {
        Clipper {
            threshold: 0.8,
            softness: 0.5,
        }
    }

    pub fn set_threshold(&mut self, val: f32) {
        self.threshold = val.clamp(0.1, 1.0);
    }

    pub fn set_softness(&mut self, val: f32) {
        self.softness = val.clamp(0.0, 1.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());

        for i in 0..len {
            output_l[i] = self.clip_sample(input_l[i]);
            output_r[i] = self.clip_sample(input_r[i]);
        }
    }

    fn clip_sample(&self, x: f32) -> f32 {
        let abs_x = x.abs();
        if abs_x <= self.threshold {
            x
        } else {
            let over = abs_x - self.threshold;
            let soft_clip = self.threshold + over * (1.0 - self.softness);
            x.signum() * soft_clip.min(1.0)
        }
    }
}

// ============================================
// CHORUS
// ============================================

#[wasm_bindgen]
pub struct Chorus {
    sample_rate: f32,
    delay_l: DelayLine,
    delay_r: DelayLine,
    lfo_phase: f32,
    rate: f32,      // Hz
    depth: f32,     // 0-1
    mix: f32,
    base_delay: f32, // samples
}

#[wasm_bindgen]
impl Chorus {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Chorus {
        let max_delay = (sample_rate * 0.05) as usize; // 50ms max
        Chorus {
            sample_rate,
            delay_l: DelayLine::new(max_delay),
            delay_r: DelayLine::new(max_delay),
            lfo_phase: 0.0,
            rate: 1.5,
            depth: 0.5,
            mix: 0.5,
            base_delay: sample_rate * 0.007, // 7ms base
        }
    }

    pub fn set_rate(&mut self, hz: f32) {
        self.rate = hz.clamp(0.1, 10.0);
    }

    pub fn set_depth(&mut self, val: f32) {
        self.depth = val.clamp(0.0, 1.0);
    }

    pub fn set_mix(&mut self, val: f32) {
        self.mix = val.clamp(0.0, 1.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        let lfo_inc = 2.0 * std::f32::consts::PI * self.rate / self.sample_rate;
        let mod_depth = self.base_delay * self.depth;

        for i in 0..len {
            self.lfo_phase += lfo_inc;
            if self.lfo_phase > 2.0 * std::f32::consts::PI {
                self.lfo_phase -= 2.0 * std::f32::consts::PI;
            }
            
            let lfo_l = self.lfo_phase.sin();
            let lfo_r = (self.lfo_phase + std::f32::consts::PI / 2.0).sin();
            
            let delay_l = self.base_delay + lfo_l * mod_depth;
            let delay_r = self.base_delay + lfo_r * mod_depth;
            
            self.delay_l.write(input_l[i]);
            self.delay_r.write(input_r[i]);
            
            let wet_l = self.delay_l.read_interpolated(delay_l);
            let wet_r = self.delay_r.read_interpolated(delay_r);
            
            output_l[i] = input_l[i] * (1.0 - self.mix) + wet_l * self.mix;
            output_r[i] = input_r[i] * (1.0 - self.mix) + wet_r * self.mix;
        }
    }

    pub fn reset(&mut self) {
        self.delay_l.reset();
        self.delay_r.reset();
        self.lfo_phase = 0.0;
    }
}

// ============================================
// PHASER
// ============================================

#[wasm_bindgen]
pub struct Phaser {
    sample_rate: f32,
    lfo_phase: f32,
    rate: f32,
    depth: f32,
    feedback: f32,
    stages: u32,
    mix: f32,
    
    // Allpass state (6 stages max)
    ap_state: [[f32; 2]; 6],
}

#[wasm_bindgen]
impl Phaser {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Phaser {
        Phaser {
            sample_rate,
            lfo_phase: 0.0,
            rate: 0.5,
            depth: 0.7,
            feedback: 0.6,
            stages: 4,
            mix: 0.5,
            ap_state: [[0.0; 2]; 6],
        }
    }

    pub fn set_rate(&mut self, hz: f32) {
        self.rate = hz.clamp(0.01, 5.0);
    }

    pub fn set_depth(&mut self, val: f32) {
        self.depth = val.clamp(0.0, 1.0);
    }

    pub fn set_feedback(&mut self, val: f32) {
        self.feedback = val.clamp(0.0, 0.95);
    }

    pub fn set_stages(&mut self, stages: u32) {
        self.stages = stages.clamp(2, 6);
    }

    pub fn set_mix(&mut self, val: f32) {
        self.mix = val.clamp(0.0, 1.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        let lfo_inc = 2.0 * std::f32::consts::PI * self.rate / self.sample_rate;

        for i in 0..len {
            self.lfo_phase += lfo_inc;
            if self.lfo_phase > 2.0 * std::f32::consts::PI {
                self.lfo_phase -= 2.0 * std::f32::consts::PI;
            }
            
            let lfo = (self.lfo_phase.sin() + 1.0) * 0.5;
            let freq = 200.0 + lfo * self.depth * 3000.0;
            let coef = (std::f32::consts::PI * freq / self.sample_rate).tan();
            let a = (coef - 1.0) / (coef + 1.0);
            
            // Process mono sum through allpass chain
            let mono = (input_l[i] + input_r[i]) * 0.5;
            let mut phased = mono + self.ap_state[0][1] * self.feedback;
            
            for s in 0..self.stages as usize {
                let ap_out = a * phased + self.ap_state[s][0] - a * self.ap_state[s][1];
                self.ap_state[s][0] = phased;
                self.ap_state[s][1] = ap_out;
                phased = ap_out;
            }
            
            output_l[i] = input_l[i] * (1.0 - self.mix) + phased * self.mix;
            output_r[i] = input_r[i] * (1.0 - self.mix) + phased * self.mix;
        }
    }

    pub fn reset(&mut self) {
        self.ap_state = [[0.0; 2]; 6];
        self.lfo_phase = 0.0;
    }
}

// ============================================
// STEREO PANNER
// ============================================

#[wasm_bindgen]
pub struct StereoPanner {
    pan: f32,         // -1 to 1
    width: f32,       // stereo width 0-2
    lfo_phase: f32,
    lfo_rate: f32,
    lfo_depth: f32,
}

#[wasm_bindgen]
impl StereoPanner {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> StereoPanner {
        StereoPanner {
            pan: 0.0,
            width: 1.0,
            lfo_phase: 0.0,
            lfo_rate: 0.0,
            lfo_depth: 0.0,
        }
    }

    pub fn set_pan(&mut self, val: f32) {
        self.pan = val.clamp(-1.0, 1.0);
    }

    pub fn set_width(&mut self, val: f32) {
        self.width = val.clamp(0.0, 2.0);
    }

    pub fn set_lfo_rate(&mut self, hz: f32) {
        self.lfo_rate = hz.clamp(0.0, 10.0);
    }

    pub fn set_lfo_depth(&mut self, val: f32) {
        self.lfo_depth = val.clamp(0.0, 1.0);
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_l: &[f32],
        input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
        sample_rate: f32,
    ) {
        let len = input_l.len().min(input_r.len()).min(output_l.len()).min(output_r.len());
        let lfo_inc = 2.0 * std::f32::consts::PI * self.lfo_rate / sample_rate;

        for i in 0..len {
            // LFO modulation
            let lfo = if self.lfo_rate > 0.0 {
                self.lfo_phase += lfo_inc;
                if self.lfo_phase > 2.0 * std::f32::consts::PI {
                    self.lfo_phase -= 2.0 * std::f32::consts::PI;
                }
                self.lfo_phase.sin() * self.lfo_depth
            } else {
                0.0
            };
            
            let pan = (self.pan + lfo).clamp(-1.0, 1.0);
            
            // Constant power panning
            let angle = (pan + 1.0) * std::f32::consts::PI / 4.0;
            let gain_l = angle.cos();
            let gain_r = angle.sin();
            
            // Stereo width (mid/side)
            let mid = (input_l[i] + input_r[i]) * 0.5;
            let side = (input_l[i] - input_r[i]) * 0.5 * self.width;
            
            let widened_l = mid + side;
            let widened_r = mid - side;
            
            output_l[i] = widened_l * gain_l;
            output_r[i] = widened_r * gain_r;
        }
    }
}

