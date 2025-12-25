#!/bin/bash

# Piano Sample Converter - Automated
# Converts downloaded piano samples to OGG format

TEMP_DIR="/tmp/piano_samples"
TARGET_DIR="/Users/alperkosan/dawg/client/public/audio/samples/instruments/piano"

mkdir -p "$TEMP_DIR"

echo "🎹 Piano Sample Converter"
echo "========================"
echo ""
echo "📁 Temp directory: $TEMP_DIR"
echo "📁 Target directory: $TARGET_DIR"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg not found!"
    echo "📦 Please install ffmpeg first:"
    echo "   brew install ffmpeg"
    exit 1
fi

echo "✅ ffmpeg found: $(which ffmpeg)"
echo ""

# Check if WAV files exist
WAV_COUNT=$(ls -1 "$TEMP_DIR"/*.wav 2>/dev/null | wc -l | tr -d ' ')

if [ "$WAV_COUNT" -eq 0 ]; then
    echo "❌ No WAV files found in $TEMP_DIR"
    echo ""
    echo "📥 Please download samples first:"
    echo "   1. Go to: https://freesound.org/people/pinkyfinger/packs/4409/"
    echo "   2. Download the pack (free account required)"
    echo "   3. Extract to: $TEMP_DIR"
    echo ""
    echo "💡 Or run this to extract:"
    echo "   unzip ~/Downloads/*piano*.zip -d $TEMP_DIR/"
    echo ""
    exit 1
fi

echo "✅ Found $WAV_COUNT WAV files"
echo ""

cd "$TEMP_DIR"

# Convert each WAV to OGG
SUCCESS_COUNT=0
FAIL_COUNT=0

for wav_file in *.wav; do
    if [ -f "$wav_file" ]; then
        # Extract base name
        base_name=$(basename "$wav_file" .wav)
        
        # Normalize name (Piano_Ds -> Ds, Piano_C -> C, etc.)
        if [[ $base_name == Piano_* ]]; then
            note_name=${base_name#Piano_}
        else
            note_name=$base_name
        fi
        
        echo "🔄 Converting: $wav_file -> ${note_name}.ogg"
        
        # Convert with high quality settings
        ffmpeg -i "$wav_file" \
               -c:a libvorbis \
               -q:a 6 \
               -ar 48000 \
               "${note_name}.ogg" \
               -y -loglevel error
        
        if [ $? -eq 0 ]; then
            echo "✅ Converted: ${note_name}.ogg"
            ((SUCCESS_COUNT++))
        else
            echo "❌ Failed: ${note_name}.ogg"
            ((FAIL_COUNT++))
        fi
    fi
done

echo ""
echo "📊 Conversion Summary:"
echo "   ✅ Success: $SUCCESS_COUNT"
echo "   ❌ Failed: $FAIL_COUNT"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "📦 Copying OGG files to target directory..."
    
    # Copy OGG files to target
    cp *.ogg "$TARGET_DIR/" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ All samples copied to: $TARGET_DIR"
        echo ""
        echo "📂 Target directory contents:"
        ls -lh "$TARGET_DIR"/*.ogg | awk '{print "   " $9 " (" $5 ")"}'
        echo ""
        echo "🎉 Done! Tell the AI: 'Sample'lar hazır, config'i güncelle'"
    else
        echo "❌ Failed to copy files"
        echo "💡 Try manually:"
        echo "   cp $TEMP_DIR/*.ogg $TARGET_DIR/"
    fi
else
    echo "❌ No files were converted successfully"
fi

echo ""
echo "🏁 Script finished!"
