#!/bin/bash

# Salamander Grand Piano - Direct OGG Download
# Downloads pre-converted OGG samples from GitHub

echo "🎹 Salamander Grand Piano - OGG Sample Downloader"
echo "=================================================="
echo ""

TARGET_DIR="/Users/alperkosan/dawg/client/public/audio/samples/instruments/piano"
TEMP_DIR="/tmp/salamander_piano"

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "📁 Target: $TARGET_DIR"
echo "📁 Temp: $TEMP_DIR"
echo ""

# GitHub repository with OGG samples
GITHUB_RAW="https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master/48khz24bit"

# Notes to download (D# notes for intermediate coverage)
declare -A NOTES=(
    ["Ds1"]="27"   # D#1
    ["Ds2"]="39"   # D#2  
    ["Ds3"]="51"   # D#3
    ["Ds4"]="63"   # D#4
    ["Ds5"]="75"   # D#5
    ["Ds6"]="87"   # D#6
    ["Ds7"]="99"   # D#7
)

echo "📋 Will download ${#NOTES[@]} samples..."
echo ""

# Salamander uses different naming: A0v1.flac, A0v2.flac, etc.
# We need to map our note names to Salamander's naming

# MIDI note to Salamander note name mapping
get_salamander_name() {
    local midi_note=$1
    
    # Salamander naming: A0, As0, B0, C1, Cs1, D1, Ds1, E1, F1, Fs1, G1, Gs1, A1, ...
    # MIDI 21 = A0, 22 = A#0/Bb0, 23 = B0, 24 = C1, ...
    
    local note_names=("C" "Cs" "D" "Ds" "E" "F" "Fs" "G" "Gs" "A" "As" "B")
    local note_index=$(( (midi_note - 12) % 12 ))
    local octave=$(( (midi_note - 12) / 12 ))
    
    # Adjust for Salamander's octave system (starts at A0 = MIDI 21)
    if [ $midi_note -lt 21 ]; then
        echo "invalid"
        return
    fi
    
    # For notes below C1 (MIDI 24), use octave 0
    if [ $midi_note -lt 24 ]; then
        octave=0
        if [ $midi_note -eq 21 ]; then
            echo "A0"
        elif [ $midi_note -eq 22 ]; then
            echo "As0"
        elif [ $midi_note -eq 23 ]; then
            echo "B0"
        fi
        return
    fi
    
    local note_name="${note_names[$note_index]}"
    echo "${note_name}${octave}"
}

echo "⚠️  Note: Salamander samples are in FLAC format, not OGG"
echo "📦 You'll need to convert them to OGG"
echo ""
echo "💡 Alternative: Let me create a simpler solution..."
echo ""

# Since direct download from Salamander is complex, let's use a different approach
echo "🎯 Recommended Approach:"
echo ""
echo "1. Install ffmpeg (if not installed):"
echo "   brew install ffmpeg"
echo ""
echo "2. Download Salamander pack manually:"
echo "   https://archive.org/download/SalamanderGrandPianoV3/SalamanderGrandPianoV3_48khz24bit.tar.xz"
echo ""
echo "3. Or use the simpler Freesound approach:"
echo "   https://freesound.org/people/pinkyfinger/packs/4409/"
echo ""
echo "4. Or let me generate synthetic samples (quick test):"
echo "   Tell me: 'Generate synthetic samples'"
echo ""

echo "🏁 Script finished - awaiting your decision"
