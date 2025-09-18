import React from 'react';
import { Wand2, Loader2, Brain, BarChart3, Music, Zap } from 'lucide-react';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';

const AIAnalysisTab = ({ instrument, instrumentBuffer }) => {
  const { analysis, isAnalyzing, error, analyzeBuffer } = useAudioAnalysis();

  const handleRunAnalysis = () => {
    if (instrumentBuffer) {
      analyzeBuffer(instrumentBuffer);
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      percussion: 'bg-red-500',
      bass: 'bg-blue-500',
      melodic: 'bg-green-500',
      ambient: 'bg-purple-500',
      unknown: 'bg-gray-500'
    };
    return colors[type] || colors.unknown;
  };

  const getTypeIcon = (type) => {
    const icons = {
      percussion: Zap,
      bass: BarChart3,
      melodic: Music,
      ambient: Brain,
      unknown: Brain
    };
    const Icon = icons[type] || icons.unknown;
    return <Icon size={16} />;
  };

  return (
    <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
      {/* Sol Panel - Kontroller */}
      <div className="w-64 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)' }}>
        
        {/* Analysis Button */}
        <div className="text-center">
          <button 
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || !instrumentBuffer}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded font-bold disabled:opacity-50 transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Wand2 size={16} />
                <span>AI Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">
            {/* Audio Type */}
            <div>
              <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--color-primary)' }}>
                Audio Type
              </h4>
              <div className={`flex items-center gap-2 px-3 py-2 rounded font-bold capitalize ${getTypeColor(analysis.audioType)}`}>
                {getTypeIcon(analysis.audioType)}
                <span>{analysis.audioType}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                Confidence: {(analysis.confidence * 100).toFixed(0)}%
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-bold text-sm mb-2">Audio Features</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Energy Level:</span>
                  <span className="font-mono">{(analysis.energy * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Brightness:</span>
                  <span className="font-mono">{(analysis.spectralCentroid / 1000).toFixed(1)}kHz</span>
                </div>
                <div className="flex justify-between">
                  <span>Noisiness:</span>
                  <span className="font-mono">{(analysis.zcr * 100).toFixed(1)}%</span>
                </div>
                {analysis.estimatedTempo && (
                  <div className="flex justify-between">
                    <span>Estimated BPM:</span>
                    <span className="font-mono text-green-400">{analysis.estimatedTempo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-bold text-sm mb-2">AI Recommendations</h4>
              <div className="space-y-2">
                {analysis.audioType === 'percussion' && (
                  <div className="text-xs p-2 bg-red-500/20 rounded">
                    • Ideal for drum patterns
                    • Try compression for punch
                  </div>
                )}
                {analysis.audioType === 'bass' && (
                  <div className="text-xs p-2 bg-blue-500/20 rounded">
                    • Great for low-end foundation
                    • Consider EQ around {Math.round(analysis.spectralCentroid)}Hz
                  </div>
                )}
                {analysis.audioType === 'melodic' && (
                  <div className="text-xs p-2 bg-green-500/20 rounded">
                    • Suitable for melodies
                    • Try reverb and delay effects
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sağ Panel - Visualization */}
      <div className="flex-grow rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="h-full flex flex-col">
          <h3 className="text-lg font-bold mb-4">Analysis Visualization</h3>
          
          {!analysis ? (
            <div className="flex-grow flex items-center justify-center" style={{ color: 'var(--color-muted)' }}>
              <div className="text-center">
                <Brain size={48} className="mx-auto mb-4 opacity-50" />
                <p className="mb-2">Run AI analysis to get intelligent insights</p>
                <div className="text-sm space-y-1">
                  <p>• Audio type detection</p>
                  <p>• Spectral feature analysis</p>
                  <p>• Tempo estimation</p>
                  <p>• Smart recommendations</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-grow">
              {/* Feature Bars Visualization */}
              <div className="mb-6">
                <h4 className="font-bold mb-3">Feature Analysis</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Energy</span>
                      <span>{(analysis.energy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${analysis.energy * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Brightness</span>
                      <span>{(analysis.brightness * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${analysis.brightness * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Noisiness</span>
                      <span>{(analysis.zcr * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(analysis.zcr * 1000, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <h5 className="font-bold text-sm mb-2">Classification</h5>
                  <div className="text-xs space-y-1">
                    <p>Type: <span className="capitalize font-mono">{analysis.audioType}</span></p>
                    <p>Confidence: <span className="font-mono">{(analysis.confidence * 100).toFixed(0)}%</span></p>
                  </div>
                </div>
                
                <div className="p-3 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <h5 className="font-bold text-sm mb-2">Timing</h5>
                  <div className="text-xs space-y-1">
                    <p>Duration: <span className="font-mono">{instrumentBuffer?.duration.toFixed(2)}s</span></p>
                    {analysis.estimatedTempo && (
                      <p>BPM: <span className="font-mono text-green-400">{analysis.estimatedTempo}</span></p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisTab;