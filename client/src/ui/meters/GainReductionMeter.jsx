import React, { useState } from 'react';

const METER_HEIGHT_PX = 140;
const MAX_GR_DB = 24;

export const GainReductionMeter = ({ dbValue = 0 }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const percentage = (Math.abs(dbValue) / MAX_GR_DB) * 100;
  const height = Math.min(100, Math.max(0, percentage));
  const markers = [-3, -6, -9, -12, -18, -24];

  return (
    <div 
      className="flex flex-col items-center gap-2 relative"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      {isTooltipVisible && (
        <div className="absolute -top-7 bg-gray-950 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
          {dbValue.toFixed(1)} dB
        </div>
      )}
      <div 
        className="relative w-6 h-[140px] bg-gray-900 rounded-md overflow-hidden border border-gray-700"
        style={{ height: `${METER_HEIGHT_PX}px` }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-amber-400 transition-[height] duration-75"
          style={{ height: `${height}%` }}
        />
        {markers.map(db => (
          <div 
            key={db}
            className="absolute left-1 right-1 h-[1px] bg-gray-700"
            style={{ bottom: `${(Math.abs(db) / MAX_GR_DB) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-gray-400">GR (dB)</span>
    </div>
  );
};
