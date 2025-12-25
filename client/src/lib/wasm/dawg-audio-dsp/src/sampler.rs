use wasm_bindgen::prelude::*;
use crate::envelope::AdsrEnvelope;
use crate::filters::{StateVariableFilter, FilterType};

// Hermite interpolation for smooth pitch shifting
fn hermite(frac: f32, s0: f32, s1: f32, s2: f32, s3: f32) -> f32 {
    let c0 = s1;
    let c1 = 0.5 * (s2 - s0);
    let c2 = s0 - 2.5 * s1 + 2.0 * s2 - 0.5 * s3;
    let c3 = 0.5 * (s3 - s0) + 1.5 * (s1 - s2);
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

#[wasm_bindgen]
pub struct Sampler {
    sample_data: Vec<f32>,       
    sample_data_right: Vec<f32>, 
    position: f64,
    speed: f64,
    sample_rate: f32,
    playing: bool,
    looping: bool,
    loop_start: usize,
    loop_end: usize,
    play_start: usize,
    play_end: usize,
    current_right: f32,
    
    // Envelope
    envelope: AdsrEnvelope,
    
    // Filters (Stereo)
    filter_l: StateVariableFilter,
    filter_r: StateVariableFilter,
    filter_enabled: bool,
    
    // Bass Boost
    bass_boost_l: StateVariableFilter,
    bass_boost_r: StateVariableFilter,
    bass_boost_gain: f32,
}

#[wasm_bindgen]
impl Sampler {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Sampler {
        Sampler {
            sample_data: Vec::new(),
            sample_data_right: Vec::new(),
            position: 0.0,
            speed: 1.0,
            sample_rate,
            playing: false,
            looping: false,
            loop_start: 0,
            loop_end: 0,
            play_start: 0,
            play_end: 0,
            current_right: 0.0,
            
            envelope: AdsrEnvelope::new(sample_rate),
            
            filter_l: StateVariableFilter::new(sample_rate),
            filter_r: StateVariableFilter::new(sample_rate),
            filter_enabled: false,
            
            bass_boost_l: {
                let mut f = StateVariableFilter::new(sample_rate);
                f.set_cutoff(85.0);
                f.set_q(0.8);
                f.set_type(FilterType::LowPass);
                f
            },
            bass_boost_r: {
                let mut f = StateVariableFilter::new(sample_rate);
                f.set_cutoff(85.0);
                f.set_q(0.8);
                f.set_type(FilterType::LowPass);
                f
            },
            bass_boost_gain: 0.0,
        }
    }

    /// Load sample data (Mono or Stereo)
    pub fn load_sample(&mut self, left_channel: &[f32], right_channel: &[f32]) {
        self.sample_data = left_channel.to_vec();
        
        if right_channel.len() == left_channel.len() {
            self.sample_data_right = right_channel.to_vec();
        } else {
            self.sample_data_right = Vec::new(); 
        }

        self.play_start = 0;
        self.play_end = self.sample_data.len();
        self.loop_start = 0;
        self.loop_end = self.sample_data.len();
        self.reset();
    }

    pub fn get_current_right(&self) -> f32 {
        self.current_right
    }

    /// Process next sample (Stereo capable)
    pub fn process(&mut self) -> f32 {
        if !self.playing || self.sample_data.is_empty() {
            self.current_right = 0.0;
            return 0.0;
        }

        // --- ENVELOPE LOGIC ---
        let env_val = self.envelope.process();
        
        // If envelope finished (Release -> Idle), stop playing
        if !self.envelope.is_active() {
            self.playing = false;
            self.current_right = 0.0;
            return 0.0;
        }

        let len = self.sample_data.len();
        let range_len = self.play_end.saturating_sub(self.play_start);

        // Safety check
        if len < 2 || range_len < 2 {
            self.playing = false;
            self.current_right = 0.0;
            return 0.0;
        }

        // --- POSITION LOGIC (Unchanged) ---
        if self.speed >= 0.0 {
            if self.position >= (self.play_end - 1) as f64 {
                if self.looping {
                    let loop_width = (self.loop_end.saturating_sub(self.loop_start)) as f64;
                    if loop_width > 0.0 {
                        self.position = self.loop_start as f64 + (self.position - self.loop_end as f64) % loop_width;
                    } else {
                         self.position = self.loop_start as f64;
                    }
                } else {
                    self.playing = false;
                    self.current_right = 0.0;
                    return 0.0;
                }
            }
        } else {
            if self.position <= self.play_start as f64 {
                 if self.looping {
                     let loop_width = (self.loop_end.saturating_sub(self.loop_start)) as f64;
                     if loop_width > 0.0 {
                        self.position = self.loop_end as f64 - (self.loop_start as f64 - self.position) % loop_width;
                     } else {
                        self.position = self.loop_end as f64;
                     }
                } else {
                    self.playing = false;
                    self.current_right = 0.0;
                    return 0.0;
                }
            }
        }

        // --- INTERPOLATION ---
        let pos_floor = self.position.floor();
        let pos_frac = (self.position - pos_floor) as f32;
        let idx_int = pos_floor as isize;

        let idx0 = (idx_int - 1).clamp(0, (len - 1) as isize) as usize;
        let idx1 = idx_int.clamp(0, (len - 1) as isize) as usize;
        let idx2 = (idx_int + 1).clamp(0, (len - 1) as isize) as usize;
        let idx3 = (idx_int + 2).clamp(0, (len - 1) as isize) as usize;

        let l0 = self.sample_data[idx0];
        let l1 = self.sample_data[idx1];
        let l2 = self.sample_data[idx2];
        let l3 = self.sample_data[idx3];
        let mut out_l = hermite(pos_frac, l0, l1, l2, l3);

        if !self.sample_data_right.is_empty() {
             let r0 = self.sample_data_right[idx0];
             let r1 = self.sample_data_right[idx1];
             let r2 = self.sample_data_right[idx2];
             let r3 = self.sample_data_right[idx3];
             self.current_right = hermite(pos_frac, r0, r1, r2, r3);
        } else {
             self.current_right = out_l;
        }
        
        // --- BASS BOOST ---
        // Always process to keep state valid, only add if gain > 0
        let bb_l_out = self.bass_boost_l.process(out_l);
        let bb_r_out = self.bass_boost_r.process(self.current_right);
        
        if self.bass_boost_gain > 0.001 {
            // Add saturated low-end (Enhancer)
            out_l += (bb_l_out * self.bass_boost_gain).tanh();
            self.current_right += (bb_r_out * self.bass_boost_gain).tanh();
        }

        // --- FILTER ---
        if self.filter_enabled {
            out_l = self.filter_l.process(out_l);
            self.current_right = self.filter_r.process(self.current_right);
        }

        // Apply Envelope
        out_l *= env_val;
        self.current_right *= env_val;

        self.position += self.speed;

        out_l
    }

    pub fn set_adsr(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.envelope.set_params(attack, decay, sustain, release);
    }

    pub fn set_filter(&mut self, cutoff: f32, q: f32, filter_type_idx: usize, enabled: bool) {
        self.filter_enabled = enabled;
        if !enabled { return; }

        let ftype = match filter_type_idx {
            0 => FilterType::LowPass,
            1 => FilterType::HighPass,
            2 => FilterType::BandPass,
            3 => FilterType::Notch,
            _ => FilterType::LowPass,
        };

        // Update L
        self.filter_l.set_cutoff(cutoff);
        self.filter_l.set_q(q);
        self.filter_l.set_type(match ftype {
            FilterType::LowPass => FilterType::LowPass,
            FilterType::HighPass => FilterType::HighPass,
            FilterType::BandPass => FilterType::BandPass,
            FilterType::Notch => FilterType::Notch,
        });

        // Update R (Mirror L settings)
        self.filter_r.set_cutoff(cutoff);
        self.filter_r.set_q(q);
        self.filter_r.set_type(match ftype {
            FilterType::LowPass => FilterType::LowPass,
            FilterType::HighPass => FilterType::HighPass,
            FilterType::BandPass => FilterType::BandPass,
            FilterType::Notch => FilterType::Notch,
        });
    }

    pub fn set_bass_boost(&mut self, amount: f32) {
         // amount 0.0 to 1.0 (0-100%)
         // Max gain ~3.0 (+10dB approx)
         self.bass_boost_gain = amount * 3.0;
    }

    pub fn release(&mut self) {
        self.envelope.release();
    }

    pub fn play(&mut self) {
        self.playing = true;
        self.envelope.trigger(); // Starts attack
        
        // Reset filters on note start? 
        // Yes, to prevent clicking from old state
        self.filter_l.reset();
        self.filter_r.reset();

        if self.speed >= 0.0 {
            self.position = self.play_start as f64;
        } else {
             self.position = if self.play_end > 0 { (self.play_end - 1) as f64 } else { 0.0 };
        }
    }

    pub fn stop(&mut self) {
        self.playing = false;
    }
    
    pub fn set_speed(&mut self, speed: f64) {
        self.speed = speed;
    }
    
    pub fn set_position(&mut self, position: f64) {
        self.position = position;
    }

    pub fn set_range(&mut self, start: usize, end: usize) {
        self.play_start = start;
        self.play_end = end.min(self.sample_data.len());
    }

    pub fn get_length(&self) -> usize {
        self.sample_data.len()
    }
    
    pub fn set_loop(&mut self, start: usize, end: usize, loop_active: bool) {
        self.loop_start = start.max(self.play_start);
        self.loop_end = end.min(self.play_end);
        self.looping = loop_active;
    }

    pub fn is_playing(&self) -> bool {
        self.playing
    }

    pub fn reset(&mut self) {
        self.position = 0.0;
        self.playing = false;
    }
}

