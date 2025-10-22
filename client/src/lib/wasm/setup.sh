#!/bin/bash

# DAWG Audio DSP - WASM Setup Script
# Automates Rust + WASM installation and project creation

set -e  # Exit on error

echo "🎯 DAWG Audio DSP - WASM Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Rust is installed
if command -v rustc &> /dev/null; then
    echo -e "${GREEN}✅ Rust is already installed${NC}"
    rustc --version
else
    echo -e "${YELLOW}⚠️  Rust is not installed${NC}"
    echo "Would you like to install Rust now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📦 Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source $HOME/.cargo/env
        echo -e "${GREEN}✅ Rust installed successfully${NC}"
    else
        echo -e "${RED}❌ Rust is required. Exiting.${NC}"
        exit 1
    fi
fi

# Check if wasm-pack is installed
if command -v wasm-pack &> /dev/null; then
    echo -e "${GREEN}✅ wasm-pack is already installed${NC}"
    wasm-pack --version
else
    echo -e "${YELLOW}📦 Installing wasm-pack...${NC}"
    cargo install wasm-pack
    echo -e "${GREEN}✅ wasm-pack installed${NC}"
fi

# Check if project exists
if [ -d "dawg-audio-dsp" ]; then
    echo -e "${YELLOW}⚠️  Project directory already exists${NC}"
    echo "Would you like to rebuild? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        cd dawg-audio-dsp
    else
        echo "Skipping project creation"
        exit 0
    fi
else
    echo "📦 Creating Rust project..."
    cargo new --lib dawg-audio-dsp
    cd dawg-audio-dsp
    echo -e "${GREEN}✅ Project created${NC}"
fi

# Create/update Cargo.toml
echo "📝 Configuring Cargo.toml..."
cat > Cargo.toml << 'EOF'
[package]
name = "dawg-audio-dsp"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = 'abort'

[profile.release.package."*"]
opt-level = 3
EOF

echo -e "${GREEN}✅ Cargo.toml configured${NC}"

# Check if lib.rs exists (don't overwrite if it has custom code)
if [ ! -f "src/lib.rs" ] || [ "$(wc -l < src/lib.rs)" -lt 10 ]; then
    echo "📝 Creating basic lib.rs template..."
    cat > src/lib.rs << 'EOF'
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmAudioProcessor {
    sample_rate: f32,
}

#[wasm_bindgen]
impl WasmAudioProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> WasmAudioProcessor {
        WasmAudioProcessor { sample_rate }
    }

    pub fn process_buffer(
        &mut self,
        _input_l: &[f32],
        _input_r: &[f32],
        output_l: &mut [f32],
        output_r: &mut [f32],
        _eq_active: bool,
        _comp_active: bool,
        gain: f32,
        _threshold: f32,
        _ratio: f32,
    ) {
        // Simple passthrough with gain for now
        let len = output_l.len().min(output_r.len());
        for i in 0..len {
            output_l[i] = _input_l[i] * gain;
            output_r[i] = _input_r[i] * gain;
        }
    }
}
EOF
    echo -e "${GREEN}✅ lib.rs template created${NC}"
    echo -e "${YELLOW}📝 Edit src/lib.rs to implement full DSP functionality${NC}"
else
    echo -e "${GREEN}✅ lib.rs already exists, keeping current version${NC}"
fi

# Build WASM module
echo ""
echo "🔨 Building WASM module..."
echo "This may take 2-5 minutes on first build..."
wasm-pack build --target web --release

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WASM module built successfully!${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Create public/wasm directory
WASM_PUBLIC_DIR="../../../../public/wasm"
mkdir -p "$WASM_PUBLIC_DIR"

# Copy WASM files to public directory
echo "📦 Copying WASM files to public directory..."
cp pkg/dawg_audio_dsp_bg.wasm "$WASM_PUBLIC_DIR/"
cp pkg/dawg_audio_dsp.js "$WASM_PUBLIC_DIR/"

if [ -f "pkg/dawg_audio_dsp.d.ts" ]; then
    cp pkg/dawg_audio_dsp.d.ts "$WASM_PUBLIC_DIR/"
fi

echo -e "${GREEN}✅ WASM files copied to public/wasm/${NC}"

# Summary
echo ""
echo "=============================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=============================="
echo ""
echo "📁 WASM module location:"
echo "   client/public/wasm/dawg_audio_dsp_bg.wasm"
echo "   client/public/wasm/dawg_audio_dsp.js"
echo ""
echo "🧪 To test:"
echo "   1. Start dev server: npm run dev"
echo "   2. Open browser console"
echo "   3. Run: const backend = await AudioProcessorFactory.createBackend('wasm', 48000)"
echo "   4. Benchmark: window.audioBackendDemo.benchmark()"
echo ""
echo "📝 Next steps:"
echo "   1. Edit src/lib.rs to implement full DSP functionality"
echo "   2. Rebuild: wasm-pack build --target web --release"
echo "   3. Copy files: ./setup.sh (will skip setup, just rebuild & copy)"
echo ""
echo "📚 Full documentation: ../../../../RUST_WASM_SETUP.md"
echo ""
