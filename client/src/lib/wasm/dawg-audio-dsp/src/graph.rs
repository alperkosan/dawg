use wasm_bindgen::prelude::*;
use std::collections::HashMap;

/// Type alias for Node ID to ensure consistency
pub type NodeId = u32;

/// The trait that all audio processing nodes must implement.
/// This allows us to store different types of nodes (Oscillator, Filter, etc.)
/// in the same graph structure.
pub trait AudioNode {
    /// Process a block of audio.
    /// inputs: A slice of input buffers (check for multi-channel).
    /// outputs: A mutable slice of output buffers to write to.
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]]);
    
    /// Handle parameter updates (optional for now)
    fn set_param(&mut self, _id: u32, _value: f32) {}
}

/// The main Audio Graph structure exposed to JavaScript.
/// It acts as the container and conductor for all audio nodes.
#[wasm_bindgen]
pub struct AudioGraph {
    // We use a HashMap to store nodes by ID.
    // Box<dyn AudioNode> allows polymorphism.
    // Send is required for potential parallelism (though WASM is single-threaded usually).
    nodes: HashMap<NodeId, Box<dyn AudioNode + Send>>,
    next_id: NodeId,
    
    // Adjacency list for connections: Source Node ID -> Vec of Destination Node IDs
    connections: HashMap<NodeId, Vec<NodeId>>,
    
    // Global sample rate
    sample_rate: f32,
}

#[wasm_bindgen]
impl AudioGraph {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> AudioGraph {
        AudioGraph {
            nodes: HashMap::new(),
            next_id: 0,
            connections: HashMap::new(),
            sample_rate,
        }
    }

    /// Process a block of audio for the entire graph.
    /// This is the entry point called by the AudioWorklet.
    pub fn process_block(&mut self, output_l: &mut [f32], output_r: &mut [f32]) {
        // Clear outputs
        for sample in output_l.iter_mut() { *sample = 0.0; }
        for sample in output_r.iter_mut() { *sample = 0.0; }

        // TODO: Implement topological sort or graph traversal here.
        // For now, we'll just process nodes in arbitrary order if they have no dependencies,
        // which won't work for a real graph yet.
        
        // This is a placeholder implementation for the infrastructure phase.
    }

    /// Add a test node (just to verify infrastructure)
    pub fn add_test_node(&mut self) -> NodeId {
        let id = self.next_id;
        self.next_id += 1;
        // logic to add a dummy node would go here
        id
    }
}
