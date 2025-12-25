/**
 * CountInOverlay - Compact count-in badge (replaces full-screen modal)
 * 
 * Shows a small, non-intrusive badge in the corner during count-in
 */

import React, { useState, useEffect } from 'react';
import './CountInOverlay.css';

export function CountInOverlay({ 
    isCountingIn, 
    countInBars, 
    bpm,
    onComplete 
}) {
    const [currentBeat, setCurrentBeat] = useState(0);
    const [totalBeats, setTotalBeats] = useState(0);

    useEffect(() => {
        if (!isCountingIn || countInBars === 0) {
            setCurrentBeat(0);
            setTotalBeats(0);
            return;
        }

        // Calculate beats per bar (assuming 4/4 time signature)
        const beatsPerBar = 4;
        const total = countInBars * beatsPerBar;
        setTotalBeats(total);
        
        const msPerBeat = (60000 / bpm);

        let beatIndex = 0;
        setCurrentBeat(1);
        
        const interval = setInterval(() => {
            beatIndex++;
            
            if (beatIndex >= total) {
                // Count-in complete
                setCurrentBeat(0);
                setTotalBeats(0);
                clearInterval(interval);
                if (onComplete) {
                    onComplete();
                }
            } else {
                setCurrentBeat(beatIndex + 1);
            }
        }, msPerBeat);

        return () => clearInterval(interval);
    }, [isCountingIn, countInBars, bpm, onComplete]);

    if (!isCountingIn || currentBeat === 0) {
        return null;
    }

    const beatsRemaining = totalBeats - currentBeat + 1;
    const isLastBeat = beatsRemaining <= 1;

    return (
        <div className="count-in-badge">
            <div className="count-in-badge-icon">
                {isLastBeat ? '🎹' : '⏱️'}
            </div>
            <div className="count-in-badge-content">
                <span className={`count-in-badge-number ${isLastBeat ? 'ready' : ''}`}>
                    {isLastBeat ? 'GO!' : beatsRemaining}
                </span>
                <div className="count-in-badge-dots">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div
                            key={i}
                            className={`count-in-dot ${i < ((currentBeat - 1) % 4) + 1 ? 'active' : ''}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default CountInOverlay;
