use std::f32::consts::PI;
use crate::filters::{StateVariableFilter, FilterType};
use wasm_bindgen::prelude::*;
use crate::envelope::AdsrEnvelope;

pub enum Waveform {
    Saw,
    Square,
    Sine,
    Triangle,
}

pub struct Oscillator {
    pub frequency: f32,
    pub sample_rate: f32,
    pub phase: f32,
    pub waveform: Waveform,
}

impl Oscillator {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            frequency: 440.0,
            sample_rate,
            phase: 0.0,
            waveform: Waveform::Saw,
        }
    }

    pub fn set_frequency(&mut self, freq: f32) {
        self.frequency = freq;
    }

    pub fn set_waveform(&mut self, shape: usize) {
        self.waveform = match shape {
            0 => Waveform::Saw,
            1 => Waveform::Square,
            2 => Waveform::Sine,
            3 => Waveform::Triangle,
            _ => Waveform::Saw,
        };
    }

    // Basic naive implementation for now. 
    // TODO: Add PolyBLEP anti-aliasing.
    pub fn process(&mut self) -> f32 {
        let phase_increment = self.frequency * 2.0 * PI / self.sample_rate;
        self.phase += phase_increment;
        if self.phase > 2.0 * PI {
            self.phase -= 2.0 * PI;
        }

        match self.waveform {
            Waveform::Sine => self.phase.sin(),
            Waveform::Square => if self.phase < PI { 1.0 } else { -1.0 },
            Waveform::Saw => (2.0 * self.phase / (2.0 * PI)) - 1.0,
            Waveform::Triangle => {
                // Triangle: 2 * |2 * (t - floor(t + 0.5))| - 1
                // Normalized phase t = phase / 2PI
                let t = self.phase / (2.0 * PI);
                2.0 * (2.0 * (t - (t + 0.5).floor()).abs()) - 1.0
            }
        }
    }
}

pub struct Voice {
    pub osc: Oscillator,
    pub env: AdsrEnvelope,
    pub filter: StateVariableFilter,
    pub active: bool,
    pub note_id: u32,
    pub velocity: f32,
}

impl Voice {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            osc: Oscillator::new(sample_rate),
            env: AdsrEnvelope::new(sample_rate),
            filter: StateVariableFilter::new(sample_rate),
            active: false,
            note_id: 0,
            velocity: 0.0,
        }
    }
    
    pub fn trigger(&mut self, note: u32, velocity: f32) {
        // MIDI to Freq: f = 440 * 2^((d-69)/12)
        let freq = 440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0);
        self.osc.set_frequency(freq);
        self.env.trigger();
        self.active = true;
        self.note_id = note;
        self.velocity = velocity;
    }
    
    pub fn release(&mut self) {
        self.env.release();
    }
    
    pub fn process(&mut self) -> f32 {
        if !self.active { return 0.0; }
        
        let mut signal = self.osc.process();
        let env_gain = self.env.process();
        
        // Simple filter processing (fixed params for now)
        signal = self.filter.process(signal);
        
        if !self.env.is_active() {
            self.active = false;
        }
        
        signal * env_gain * self.velocity
    }
}

#[wasm_bindgen]
pub struct PolySynth {
    voices: Vec<Voice>,
    sample_rate: f32,
}

#[wasm_bindgen]
impl PolySynth {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, max_voices: usize) -> PolySynth {
        let mut voices = Vec::with_capacity(max_voices);
        for _ in 0..max_voices {
            voices.push(Voice::new(sample_rate));
        }
        
        Self {
            voices,
            sample_rate,
        }
    }
    
    #[wasm_bindgen]
    pub fn trigger_note(&mut self, note: u32, velocity: f32) {
        // 1. Find free voice
        for voice in &mut self.voices {
            if !voice.active {
                voice.trigger(note, velocity);
                return;
            }
        }
        // 2. If no free voice, steal oldest (simple round-robin or first approximation)
        // For now, just retrigger the first one (naive stealing)
        if !self.voices.is_empty() {
             self.voices[0].trigger(note, velocity);
        }
    }
    
    #[wasm_bindgen]
    pub fn release_note(&mut self, note: u32) {
        for voice in &mut self.voices {
            // Note: handles same note triggered multiple times by releasing all of them
            if voice.active && voice.note_id == note {
                voice.release();
            }
        }
    }
    
    #[wasm_bindgen]
    pub fn set_filter_params(&mut self, cutoff: f32, q: f32, filter_type_idx: usize) {
        let ftype = match filter_type_idx {
            0 => FilterType::LowPass,
            1 => FilterType::HighPass,
            2 => FilterType::BandPass,
            3 => FilterType::Notch,
            _ => FilterType::LowPass,
        };
        
        for voice in &mut self.voices {
            voice.filter.set_cutoff(cutoff);
            voice.filter.set_q(q);
            // voice.filter.set_type(ftype); // Ownership issue if not copy?
            // Re-match to be safe or ensure Copy derive in filters.rs
            voice.filter.set_type(match ftype {
                FilterType::LowPass => FilterType::LowPass,
                FilterType::HighPass => FilterType::HighPass,
                FilterType::BandPass => FilterType::BandPass,
                FilterType::Notch => FilterType::Notch,
            });
        }
    }

    #[wasm_bindgen]
    pub fn process(&mut self) -> f32 {
        let mut mix = 0.0;
        for voice in &mut self.voices {
            mix += voice.process();
        }
        // Simple limiter
        mix.max(-1.0).min(1.0)
    }
}
