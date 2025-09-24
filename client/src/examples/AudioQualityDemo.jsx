// Audio Quality Demo - Test the new audio quality system
import React, { useState, useEffect } from 'react';
import AudioQualitySettings from '../components/AudioQualitySettings';
import { testAudioQuality } from '../lib/utils/audioQualityTester';
import { applyDynamicConfig, getQualityManager } from '../lib/EngineConfig';
import { AudioContextService } from '../lib/services/AudioContextService';

const AudioQualityDemo = () => {
    const [testResults, setTestResults] = useState(null);
    const [isTestingRunning, setIsTestingRunning] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [appliedSettings, setAppliedSettings] = useState(null);

    // Run audio quality test
    const runQualityTest = async () => {
        setIsTestingRunning(true);
        try {
            const audioEngine = AudioContextService.getAudioEngine();
            if (!audioEngine) {
                alert('Audio engine not available. Please initialize the audio system first.');
                return;
            }

            console.log('🧪 Running comprehensive audio quality test...');
            const results = await testAudioQuality(audioEngine);
            setTestResults(results);
            console.log('📊 Test completed:', results);

        } catch (error) {
            console.error('❌ Quality test failed:', error);
            alert('Quality test failed: ' + error.message);
        } finally {
            setIsTestingRunning(false);
        }
    };

    // Apply audio settings
    const handleSettingsChange = async (newSettings) => {
        try {
            const audioEngine = AudioContextService.getAudioEngine();
            if (!audioEngine) {
                console.warn('Audio engine not available');
                return;
            }

            const result = await applyDynamicConfig(audioEngine, newSettings);
            setAppliedSettings(result);

            console.log('🎛️ Settings applied:', result);

            // Re-run test to see the impact
            if (testResults) {
                setTimeout(runQualityTest, 1000);
            }

        } catch (error) {
            console.error('❌ Failed to apply settings:', error);
        }
    };

    // Benchmark system on mount
    useEffect(() => {
        const benchmarkSystem = async () => {
            try {
                const qualityManager = getQualityManager();
                if (!qualityManager.capabilities) {
                    await qualityManager.initialize();
                }
                console.log('🔍 System benchmarked:', qualityManager.capabilities);
            } catch (error) {
                console.error('Benchmark failed:', error);
            }
        };

        benchmarkSystem();
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', textAlign: 'center' }}>
                <h1>🎵 DAWG Audio Quality System Demo</h1>
                <p>Test and configure your audio engine for optimal performance</p>
            </header>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', justifyContent: 'center' }}>
                <button
                    onClick={runQualityTest}
                    disabled={isTestingRunning}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: isTestingRunning ? '#666' : '#0066cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isTestingRunning ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isTestingRunning ? '🔄 Testing...' : '🧪 Run Quality Test'}
                </button>

                <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#6b46c1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    {settingsOpen ? '❌ Close Settings' : '⚙️ Audio Settings'}
                </button>
            </div>

            {/* Settings Panel */}
            {settingsOpen && (
                <div style={{ marginBottom: '32px', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <AudioQualitySettings
                        onSettingsChange={handleSettingsChange}
                        currentEngine={AudioContextService.getAudioEngine()}
                    />
                </div>
            )}

            {/* Applied Settings Display */}
            {appliedSettings && (
                <div style={{
                    marginBottom: '32px',
                    padding: '20px',
                    backgroundColor: '#f0f8ff',
                    border: '1px solid #0066cc',
                    borderRadius: '8px'
                }}>
                    <h3>✅ Settings Applied Successfully</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        <div>
                            <strong>Sample Rate:</strong> {appliedSettings.applied?.sampleRate / 1000}kHz
                        </div>
                        <div>
                            <strong>Buffer Size:</strong> {appliedSettings.applied?.bufferSize} samples
                        </div>
                        <div>
                            <strong>Polyphony:</strong> {appliedSettings.applied?.maxPolyphony} voices
                        </div>
                        <div>
                            <strong>Mixer Channels:</strong> {appliedSettings.applied?.mixerChannels}
                        </div>
                    </div>

                    {appliedSettings.performanceImpact && (
                        <div style={{ marginTop: '16px' }}>
                            <strong>Performance Impact:</strong>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                <li>CPU: {Math.round(appliedSettings.performanceImpact.cpu * 100)}%</li>
                                <li>Memory: {Math.round(appliedSettings.performanceImpact.memory * 100)}%</li>
                                <li>Quality: {Math.round(appliedSettings.performanceImpact.quality * 100)}%</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Test Results Display */}
            {testResults && (
                <div style={{
                    padding: '24px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, marginRight: '16px' }}>📊 Audio Quality Report</h2>
                        <span style={{
                            padding: '4px 12px',
                            backgroundColor: testResults.overallGrade === 'A+' ? '#10b981' :
                                           testResults.overallGrade.startsWith('A') ? '#059669' :
                                           testResults.overallGrade.startsWith('B') ? '#f59e0b' : '#ef4444',
                            color: 'white',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                        }}>
                            Grade: {testResults.overallGrade}
                        </span>
                    </div>

                    <p style={{ fontSize: '16px', marginBottom: '24px', fontStyle: 'italic' }}>
                        {testResults.summary}
                    </p>

                    {/* Audio Specifications */}
                    <div style={{ marginBottom: '32px' }}>
                        <h3>🎵 Audio Specifications</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                            {Object.entries(testResults.audioSpecs || {}).map(([key, spec]) => (
                                <div key={key} style={{
                                    padding: '12px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong style={{ textTransform: 'capitalize' }}>
                                            {key.replace(/([A-Z])/g, ' $1')}:
                                        </strong>
                                        <span style={{
                                            padding: '2px 6px',
                                            backgroundColor: spec.grade?.startsWith('A') ? '#10b981' :
                                                           spec.grade?.startsWith('B') ? '#f59e0b' : '#ef4444',
                                            color: 'white',
                                            borderRadius: '3px',
                                            fontSize: '12px'
                                        }}>
                                            {spec.grade}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#666' }}>
                                        <div><strong>Current:</strong> {spec.value}</div>
                                        <div><strong>Standard:</strong> {spec.standard}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DAW Comparison */}
                    {testResults.dawComparison && (
                        <div style={{ marginBottom: '32px' }}>
                            <h3>🏆 DAW Comparison</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                                {Object.entries(testResults.dawComparison).map(([key, comparison]) => (
                                    <div key={key} style={{
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <strong style={{ textTransform: 'capitalize' }}>
                                                {key.replace(/([A-Z])/g, ' $1')}:
                                            </strong>
                                            <span style={{
                                                padding: '2px 6px',
                                                backgroundColor: comparison.grade?.startsWith('A') ? '#10b981' :
                                                               comparison.grade?.startsWith('B') ? '#f59e0b' : '#ef4444',
                                                color: 'white',
                                                borderRadius: '3px',
                                                fontSize: '12px'
                                            }}>
                                                {comparison.grade}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#666' }}>
                                            <div><strong>DAWG:</strong> {comparison.current}</div>
                                            <div><strong>Industry:</strong> {comparison.comparison || comparison.flStudio}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {testResults.recommendations?.length > 0 && (
                        <div>
                            <h3>💡 Recommendations</h3>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                {testResults.recommendations.map((rec, index) => (
                                    <li key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
                                        {rec}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Demo Instructions */}
            <div style={{
                marginTop: '32px',
                padding: '20px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #ddd',
                borderRadius: '8px'
            }}>
                <h3>📋 How to Use This Demo</h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Run Quality Test:</strong> Click "Run Quality Test" to analyze your current audio setup</li>
                    <li><strong>Open Settings:</strong> Click "Audio Settings" to see machine-optimized presets</li>
                    <li><strong>Choose Preset:</strong> Select a quality preset that matches your system capabilities</li>
                    <li><strong>Advanced Mode:</strong> Toggle advanced settings for fine-tuning</li>
                    <li><strong>Apply & Test:</strong> Apply settings and re-run the test to see improvements</li>
                </ol>

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e6f3ff', borderRadius: '4px' }}>
                    <strong>💡 Tip:</strong> The system automatically detects your machine's capabilities and recommends
                    the best settings. Green grades (A+, A) indicate professional-quality performance!
                </div>
            </div>
        </div>
    );
};

export default AudioQualityDemo;