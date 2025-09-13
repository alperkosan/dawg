import React from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { Download, Upload } from 'lucide-react';

// Renk seçici bileşeni, artık kendi font boyutunu temadan alıyor
const ColorInput = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="capitalize" style={{ fontSize: 'var(--font-size-body)' }}>{label.replace(/([A-Z])/g, ' $1')}</label>
    <div className="flex items-center" style={{ gap: 'var(--gap-controls)' }}>
      <span className="font-mono" style={{ fontSize: 'var(--font-size-label)' }}>{value}</span>
      <input 
        type="color" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 p-0 border-none rounded cursor-pointer bg-transparent"
      />
    </div>
  </div>
);

// Stil slider bileşeni, artık kendi font boyutunu temadan alıyor
const StyleSlider = ({ label, value, onChange, min = 0, max = 2.5, step = 0.05 }) => (
    <div className="flex items-center justify-between">
        <label className="capitalize" style={{ fontSize: 'var(--font-size-body)' }}>{label.replace('--', '').replace(/-/g, ' ')}</label>
        <div className="flex items-center w-1/2" style={{ gap: 'var(--gap-controls)' }}>
             <input
              type="range"
              min={min} max={max} step={step}
              value={parseFloat(value)}
              onChange={(e) => onChange(e.target.value)}
              className="w-full"
            />
            <span className="font-mono w-10 text-right" style={{ fontSize: 'var(--font-size-label)' }}>{parseFloat(value).toFixed(2)}</span>
        </div>
    </div>
);


export const ThemeEditor = () => {
  const { themes, activeThemeId, getActiveTheme, updateTheme, addTheme } = useThemeStore();
  const activeTheme = getActiveTheme();

  if (!activeTheme) {
    return <div className="p-4">Aktif tema bulunamadı.</div>;
  }

  const handleColorChange = (colorName, value) => {
    updateTheme(activeThemeId, { colors: { [colorName]: value } });
  };

  const handleStyleChange = (styleName, value) => {
     updateTheme(activeThemeId, { styles: { [styleName]: `${value}rem` } });
  };
  
  const handleExport = () => {
    const themeJson = JSON.stringify(activeTheme, null, 2);
    navigator.clipboard.writeText(themeJson).then(() => alert('Tema JSON olarak panoya kopyalandı!'));
  };

  const handleImport = () => {
    try {
      const themeJson = prompt("Lütfen tema JSON'unu buraya yapıştırın:");
      if (themeJson) {
        const newTheme = JSON.parse(themeJson);
        addTheme({ name: `${newTheme.name} (Kopya)`, colors: newTheme.colors, styles: newTheme.styles });
        alert('Tema başarıyla içe aktarıldı!');
      }
    } catch (e) {
      alert('Geçersiz JSON formatı. Lütfen kontrol edin.');
    }
  };

  return (
    <div 
      className="bg-[var(--color-surface)] h-full overflow-y-auto text-[var(--color-text)]"
      style={{ padding: 'var(--padding-container)' }}
    >
      <h2 
        className="font-bold"
        style={{ fontSize: 'var(--font-size-header)', marginBottom: 'var(--gap-container)' }}
      >
        Tema: {activeTheme.name}
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-container)' }}>
        <div>
          <h3 
            className="font-bold border-b border-[var(--color-muted)]"
            style={{ fontSize: 'var(--font-size-subheader)', marginBottom: 'var(--gap-controls)', paddingBottom: 'var(--padding-controls)' }}
          >
            Renk Paleti
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-controls)', padding: 'var(--padding-controls)' }}>
            {Object.entries(activeTheme.colors).map(([key, value]) => (
              <ColorInput key={key} label={key} value={value} onChange={(v) => handleColorChange(key, v)} />
            ))}
          </div>
        </div>
        
        <div>
          <h3 
            className="font-bold border-b border-[var(--color-muted)]"
            style={{ fontSize: 'var(--font-size-subheader)', marginBottom: 'var(--gap-controls)', paddingBottom: 'var(--padding-controls)' }}
          >
            Stil Ayarları (rem)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-controls)', padding: 'var(--padding-controls)' }}>
            {Object.entries(activeTheme.styles).map(([key, value]) => (
               <StyleSlider key={key} label={key} value={value} onChange={(v) => handleStyleChange(key, v)} />
            ))}
          </div>
        </div>

        <div className="flex" style={{ gap: 'var(--gap-controls)', paddingTop: 'var(--gap-container)' }}>
          <button onClick={handleExport} className="btn-primary flex-1 flex items-center justify-center gap-2"><Download size={16}/> Dışa Aktar</button>
          <button onClick={handleImport} className="btn-primary flex-1 flex items-center justify-center gap-2"><Upload size={16}/> İçe Aktar</button>
        </div>
      </div>
    </div>
  );
};