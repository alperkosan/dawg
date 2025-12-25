#!/bin/bash

# Piano Sample Download Script
# This script helps download and prepare piano samples

echo "🎹 Piano Sample Setup Script"
echo "=============================="
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg not found!"
    echo "📦 Installing ffmpeg via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo "❌ Homebrew not found. Please install ffmpeg manually:"
        echo "   brew install ffmpeg"
        exit 1
    fi
fi

echo "✅ ffmpeg found: $(which ffmpeg)"
echo ""

# Create temp directory for downloads
TEMP_DIR="/tmp/piano_samples"
TARGET_DIR="/Users/alperkosan/dawg/client/public/audio/samples/instruments/piano"

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "📁 Working directory: $TEMP_DIR"
echo "🎯 Target directory: $TARGET_DIR"
echo ""

# Function to download and convert a sample
download_and_convert() {
    local url=$1
    local output_name=$2
    local note_name=$3
    
    echo "⬇️  Downloading $note_name..."
    
    # Download using curl
    curl -L -o "temp_${output_name}.wav" "$url"
    
    if [ $? -eq 0 ]; then
        echo "✅ Downloaded $note_name"
        
        # Convert to OGG
        echo "🔄 Converting to OGG..."
        ffmpeg -i "temp_${output_name}.wav" -c:a libvorbis -q:a 6 "${output_name}.ogg" -y -loglevel error
        
        if [ $? -eq 0 ]; then
            echo "✅ Converted $note_name to OGG"
            
            # Copy to target directory
            cp "${output_name}.ogg" "$TARGET_DIR/"
            echo "✅ Copied to target directory"
            echo ""
        else
            echo "❌ Failed to convert $note_name"
        fi
        
        # Cleanup temp WAV
        rm "temp_${output_name}.wav"
    else
        echo "❌ Failed to download $note_name"
    fi
}

echo "📋 Sample Download Plan:"
echo "   - This script will guide you through downloading samples"
echo "   - You'll need to manually download from Freesound.org"
echo "   - Then run this script to convert them"
echo ""

echo "📝 Instructions:"
echo "1. Go to: https://freesound.org/people/pinkyfinger/packs/4409/"
echo "2. Download the pack (you may need to create a free account)"
echo "3. Extract the ZIP file"
echo "4. Copy the WAV files to: $TEMP_DIR"
echo "5. Run this script again to convert them"
echo ""

# Check if there are any WAV files in the temp directory
WAV_COUNT=$(ls -1 *.wav 2>/dev/null | wc -l)

if [ $WAV_COUNT -gt 0 ]; then
    echo "✅ Found $WAV_COUNT WAV files in $TEMP_DIR"
    echo "🔄 Converting to OGG format..."
    echo ""
    
    # Convert all WAV files to OGG
    for file in *.wav; do
        if [ -f "$file" ]; then
            base_name=$(basename "$file" .wav)
            echo "Converting: $file -> ${base_name}.ogg"
            ffmpeg -i "$file" -c:a libvorbis -q:a 6 "${base_name}.ogg" -y -loglevel error
            
            if [ $? -eq 0 ]; then
                echo "✅ Converted: ${base_name}.ogg"
            else
                echo "❌ Failed: ${base_name}.ogg"
            fi
        fi
    done
    
    echo ""
    echo "📦 Copying OGG files to target directory..."
    cp *.ogg "$TARGET_DIR/" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ All samples copied successfully!"
        echo ""
        echo "📊 Summary:"
        echo "   - Converted: $(ls -1 *.ogg 2>/dev/null | wc -l) files"
        echo "   - Location: $TARGET_DIR"
        echo ""
        echo "🎉 Done! Now tell the AI: 'Sample'ları kopyaladım, config'i güncelle'"
    else
        echo "❌ Failed to copy files"
    fi
else
    echo "⚠️  No WAV files found in $TEMP_DIR"
    echo ""
    echo "💡 Alternative: Use Salamander Grand Piano"
    echo "   Run: ./download_salamander.sh"
fi

echo ""
echo "🏁 Script finished!"
