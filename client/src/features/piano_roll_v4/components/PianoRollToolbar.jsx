import React from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { SNAP_CONFIG } from '../config';

export const PianoRollToolbar = () => {
  // State'i bir obje olarak değil, ayrı ayrı seçiyoruz.
  // Bu, her render'da yeni bir obje oluşturulmasını engeller.
  const currentTool = usePianoRollStore((state) => state.currentTool);
  const setTool = usePianoRollStore((state) => state.setTool);
  const snapValue = usePianoRollStore((state) => state.snapValue);
  const setSnapValue = usePianoRollStore((state) => state.setSnapValue);

  const snapKeys = Object.keys(SNAP_CONFIG);
  // Mevcut snap değerine karşılık gelen anahtarı bulma mantığı doğru.
  const currentSnapKey = Object.keys(SNAP_CONFIG).find(key => SNAP_CONFIG[key] === snapValue);

  return (
    <div style={styles.toolbar}>
      <div>
        <button onClick={() => setTool('select')} style={currentTool === 'select' ? styles.activeButton : styles.button}>Select</button>
        <button onClick={() => setTool('pencil')} style={currentTool === 'pencil' ? styles.activeButton : styles.button}>Pencil</button>
        <button onClick={() => setTool('eraser')} style={currentTool === 'eraser' ? styles.activeButton : styles.button}>Eraser</button>
      </div>
      <div>
        <label htmlFor="snap-select">Snap: </label>
        <select
          id="snap-select"
          value={currentSnapKey}
          onChange={(e) => setSnapValue(e.target.value)}
          style={styles.select}
        >
          {snapKeys.map(key => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Basit stil objeleri
const styles = {
  toolbar: { padding: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2a' },
  button: { background: '#555', color: 'white', border: '1px solid #777', marginRight: '5px', cursor: 'pointer' },
  activeButton: { background: '#4a9eff', color: 'white', border: '1px solid #4a9eff', marginRight: '5px', cursor: 'pointer' },
  select: { background: '#555', color: 'white', border: '1px solid #777' }
}