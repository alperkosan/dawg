// client/src/components/instruments/InstrumentSettings.jsx güncellemesi
export const InstrumentSettings = ({ instrument }) => {
  const [useWorklet, setUseWorklet] = useState(instrument.settings?.lowLatency || false);

  const handleWorkletToggle = (checked) => {
    setUseWorklet(checked);
    
    const updatedSettings = {
      ...instrument.settings,
      lowLatency: checked,
      customDSP: checked
    };

    // Store'u güncelle
    useInstrumentsStore.getState().updateInstrument(
      instrument.id, 
      { settings: updatedSettings },
      false // reconcile gerekmez, sadece ayar değişikliği
    );
  };

  return (
    <div className="instrument-settings">
      {/* Mevcut ayarlar */}
      
      <div className="setting-group">
        <h4>Performance</h4>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={useWorklet}
            onChange={(e) => handleWorkletToggle(e.target.checked)}
          />
          <span>Ultra-Low Latency Mode</span>
          <span className="text-xs text-gray-500">
            (AudioWorklet - 5ms latency)
          </span>
        </label>
      </div>
    </div>
  );
};