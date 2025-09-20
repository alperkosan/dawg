import React from 'react';
import { Bot, Loader2, Brain, BarChart3, Music, Zap } from 'lucide-react';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis'; // Hook'u eski yoldan alıyoruz

const AIAnalysisTab = ({ instrumentBuffer }) => {
  const { analysis, isAnalyzing, error, analyzeBuffer } = useAudioAnalysis();

  const handleRunAnalysis = () => {
    if (instrumentBuffer) {
      analyzeBuffer(instrumentBuffer);
    }
  };

  if (!instrumentBuffer) {
      return <div className="analysis-placeholder">Analiz için bir ses dosyası yükleyin.</div>
  }

  return (
    <div className="ai-analysis-tab">
      <button 
        onClick={handleRunAnalysis}
        disabled={isAnalyzing}
        className="ai-analysis-tab__button"
      >
        {isAnalyzing ? <Loader2 className="animate-spin" /> : <Bot />}
        <span>{isAnalyzing ? 'Analiz Ediliyor...' : 'AI Analizini Başlat'}</span>
      </button>

      {error && <div className="ai-analysis-tab__error">{error}</div>}

      {analysis ? (
        <div className="ai-analysis-tab__results">
          <div className="ai-analysis-tab__result-item">
            <span className="label">Ses Tipi</span>
            <span className="value type">{analysis.audioType}</span>
          </div>
          <div className="ai-analysis-tab__result-item">
            <span className="label">Enerji (RMS)</span>
            <span className="value">{(analysis.energy * 100).toFixed(1)}%</span>
          </div>
           <div className="ai-analysis-tab__result-item">
            <span className="label">Parlaklık</span>
            <span className="value">{(analysis.spectralCentroid / 1000).toFixed(1)} kHz</span>
          </div>
          {analysis.estimatedTempo && (
             <div className="ai-analysis-tab__result-item">
                <span className="label">Tahmini BPM</span>
                <span className="value bpm">{analysis.estimatedTempo}</span>
            </div>
          )}
        </div>
      ) : (
          <div className="analysis-placeholder">
              <Brain size={32} />
              <p>Ses dosyanız hakkında akıllı bilgiler edinin.</p>
          </div>
      )}
    </div>
  );
};

export default AIAnalysisTab;