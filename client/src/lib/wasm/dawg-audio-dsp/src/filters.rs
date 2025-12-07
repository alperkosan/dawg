use std::f32::consts::PI;

pub enum FilterType {
    LowPass,
    HighPass,
    BandPass,
    Notch,
}

pub struct StateVariableFilter {
    pub cutoff: f32,
    pub q: f32,
    pub sample_rate: f32,
    pub filter_type: FilterType,
    
    // State
    z1: f32,
    z2: f32,
}

impl StateVariableFilter {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            cutoff: 1000.0,
            q: 0.707,
            sample_rate,
            filter_type: FilterType::LowPass,
            z1: 0.0,
            z2: 0.0,
        }
    }

    pub fn set_cutoff(&mut self, cutoff: f32) {
        self.cutoff = cutoff.clamp(20.0, 20000.0);
    }

    pub fn set_q(&mut self, q: f32) {
        self.q = q.max(0.1);
    }
    
    pub fn set_type(&mut self, filter_type: FilterType) {
        self.filter_type = filter_type;
    }

    // Chamberlin SVF Implementation (Digital State Variable Filter)
    // Stability limit: f < fs/6
    pub fn process(&mut self, input: f32) -> f32 {
        let f = 2.0 * (PI * self.cutoff / self.sample_rate).sin();
        let q_inv = 1.0 / self.q;

        let low = self.z2 + f * self.z1;
        let high = input - low - q_inv * self.z1;
        let band = f * high + self.z1;
        let notch = high + low;

        self.z1 = band;
        self.z2 = low;

        match self.filter_type {
            FilterType::LowPass => low,
            FilterType::HighPass => high,
            FilterType::BandPass => band,
            FilterType::Notch => notch,
        }
    }
    
    pub fn reset(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }
}

// ============================================
// DELAY & REVERB COMPONENTS
// ============================================

pub struct DelayLine {
    buffer: Vec<f32>,
    index: usize,
}

impl DelayLine {
    pub fn new(size: usize) -> DelayLine {
        // Safety: Ensure buffer is never empty to prevent modulo-by-zero panics
        let actual_size = size.max(16); 
        DelayLine {
            buffer: vec![0.0; actual_size],
            index: 0,
        }
    }

    pub fn read(&self) -> f32 {
        self.buffer[self.index]
    }

    pub fn read_at(&self, offset: usize) -> f32 {
        let idx = (self.index + self.buffer.len() - offset) % self.buffer.len();
        self.buffer[idx]
    }

    // Linear interpolation read
    // Linear interpolation read with safety against underflow
    pub fn read_interpolated(&self, delay_samples: f32) -> f32 {
        let delay_int = delay_samples.floor() as usize;
        let delay_frac = delay_samples - delay_int as f32;

        let buf_len = self.buffer.len();
        
        // Safe modulo arithmetic for ring buffer
        // We use % buf_len on the delay itself to ensure it's within range [0, buf_len)
        let offset = delay_int % buf_len;
        
        // Calculate read index safely
        let idx1 = if self.index >= offset {
            self.index - offset
        } else {
            self.index + buf_len - offset
        };
        
        // idx2 is idx1 - 1 (wrapping)
        let idx2 = if idx1 == 0 { buf_len - 1 } else { idx1 - 1 };

        let s1 = self.buffer[idx1];
        let s2 = self.buffer[idx2];

        s1 + (s2 - s1) * delay_frac
    }

    pub fn write(&mut self, value: f32) {
        self.buffer[self.index] = value;
        self.index = (self.index + 1) % self.buffer.len();
    }

    pub fn reset(&mut self) {
        for x in &mut self.buffer {
            *x = 0.0;
        }
        self.index = 0;
    }
}

pub struct CombFilter {
    delay: DelayLine,
    filter_state: f32,
    filter_state2: f32, // Second pole
    pub base_size: usize,
}

impl CombFilter {
    pub fn new(size: usize) -> CombFilter {
        CombFilter {
            delay: DelayLine::new(size),
            filter_state: 0.0,
            filter_state2: 0.0,
            base_size: size,
        }
    }

    pub fn process(&mut self, input: f32, feedback: f32, damp1: f32, damp2: f32) -> f32 {
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
    pub fn process_modulated(&mut self, input: f32, feedback: f32, damp1: f32, damp2: f32, mod_delay: f32) -> f32 {
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

    pub fn reset(&mut self) {
        self.delay.reset();
        self.filter_state = 0.0;
        self.filter_state2 = 0.0;
    }
}

pub struct AllpassFilter {
    delay: DelayLine,
}

impl AllpassFilter {
    pub fn new(size: usize) -> AllpassFilter {
        AllpassFilter {
            delay: DelayLine::new(size),
        }
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let delayed = self.delay.read();
        let output = -input + delayed;
        let feedback = input + delayed * 0.5;
        
        self.delay.write(feedback);
        
        output
    }

    pub fn reset(&mut self) {
        self.delay.reset();
    }
}
