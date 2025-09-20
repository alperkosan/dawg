import React, { useRef, useEffect, useState, memo } from 'react';
import { MeteringService } from '../../../lib/core/MeteringService';

export const LevelMeterV2 = memo(({ trackId }) => {
    const [level, setLevel] = useState(-Infinity);
    const [peak, setPeak] = useState(false);
    const peakTimeoutRef = useRef(null);

    useEffect(() => {
        const meterId = `${trackId}-output`;
        const handleLevel = (dbValue) => {
            if (typeof dbValue === 'number' && isFinite(dbValue)) {
                setLevel(dbValue);
                if (dbValue > -0.5) {
                    setPeak(true);
                    if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current);
                    peakTimeoutRef.current = setTimeout(() => setPeak(false), 1500);
                }
            }
        };
        MeteringService.subscribe(meterId, handleLevel);
        return () => {
            MeteringService.unsubscribe(meterId, handleLevel);
            if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current);
        };
    }, [trackId]);

    const levelPercent = level > -60 ? ((level + 60) / 66) * 100 : 0;

    return (
        <div className="level-meter-v2">
            <div className="level-meter-v2-bar" style={{ height: `${levelPercent}%` }} />
            <div className={`level-meter-v2-peak ${peak ? 'active' : ''}`} />
        </div>
    );
});