use wasm_bindgen::prelude::*;

#[derive(Copy, Clone, PartialEq, Debug)]
pub enum EnvelopePhase {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct AdsrEnvelope {
    // Parameters (Time in seconds)
    pub attack_time: f32,
    pub decay_time: f32,
    pub sustain_level: f32,
    pub release_time: f32,
    
    // State
    sample_rate: f32,
    phase: EnvelopePhase,
    value: f32,
    
    // Increment/Decrement steps
    attack_step: f32,
    decay_step: f32,
    release_step: f32,
}

#[wasm_bindgen]
impl AdsrEnvelope {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            attack_time: 0.001,
            decay_time: 0.1,
            sustain_level: 1.0, 
            release_time: 0.05,
            
            sample_rate,
            phase: EnvelopePhase::Idle,
            value: 0.0,
            
            attack_step: 0.0,
            decay_step: 0.0,
            release_step: 0.0,
        }
    }

    pub fn set_params(&mut self, attack: f32, decay: f32, sustain: f32, release: f32) {
        self.attack_time = attack;
        self.decay_time = decay;
        self.sustain_level = sustain.clamp(0.0, 1.0);
        self.release_time = release;
        self.recalculate_steps();
    }
    
    fn recalculate_steps(&mut self) {
        let attack_samples = self.attack_time * self.sample_rate;
        let decay_samples = self.decay_time * self.sample_rate;
        let release_samples = self.release_time * self.sample_rate;
        
        // Attack: 0.0 -> 1.0
        self.attack_step = if attack_samples > 0.0 { 1.0 / attack_samples } else { 1.0 };
        
        // Decay: 1.0 -> Sustain
        let decay_dist = 1.0 - self.sustain_level;
        self.decay_step = if decay_samples > 0.0 { decay_dist / decay_samples } else { decay_dist };
        
        // Release: Sustain -> 0.0 (Assuming release starts from sustain level contextually, 
        // but robust implementation acts from *current value*)
        // Standard ADSR usually calculates constant rate for release.
        // We will calculate rate to drop 1.0 -> 0.0 in release_time seconds.
        self.release_step = if release_samples > 0.0 { 1.0 / release_samples } else { 1.0 };
    }

    pub fn trigger(&mut self) {
        self.phase = EnvelopePhase::Attack;
        self.recalculate_steps(); // Ensure steps are fresh
        // Don't reset value if retriggering (legato), or maybe reset? 
        // For standard sampler, usually reset unless special legato mode.
        // self.value = 0.0; 
    }

    pub fn release(&mut self) {
        if self.phase != EnvelopePhase::Idle {
            self.phase = EnvelopePhase::Release;
            self.recalculate_steps();
        }
    }
    
    pub fn process(&mut self) -> f32 {
        match self.phase {
            EnvelopePhase::Idle => {
                self.value = 0.0;
            },
            EnvelopePhase::Attack => {
                self.value += self.attack_step;
                if self.value >= 1.0 {
                    self.value = 1.0;
                    self.phase = EnvelopePhase::Decay;
                }
            },
            EnvelopePhase::Decay => {
                self.value -= self.decay_step;
                if self.value <= self.sustain_level {
                    self.value = self.sustain_level;
                    self.phase = EnvelopePhase::Sustain;
                }
            },
            EnvelopePhase::Sustain => {
                self.value = self.sustain_level;
            },
            EnvelopePhase::Release => {
                self.value -= self.release_step;
                if self.value <= 0.0 {
                    self.value = 0.0;
                    self.phase = EnvelopePhase::Idle;
                }
            }
        }
        self.value
    }
    
    pub fn is_active(&self) -> bool {
        match self.phase {
            EnvelopePhase::Idle => false,
            _ => true
        }
    }
    
    pub fn get_value(&self) -> f32 {
        self.value
    }
}
