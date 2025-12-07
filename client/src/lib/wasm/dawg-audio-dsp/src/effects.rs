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
