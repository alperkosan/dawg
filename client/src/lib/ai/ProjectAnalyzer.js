/**
 * Project Analyzer
 * 
 * Mevcut projeyi analiz ederek AI enstrüman önerileri üretir
 */

export class ProjectAnalyzer {
  /**
   * Analyze current project and suggest AI instruments
   */
  analyzeProject(projectState) {
    const { patterns, instruments } = projectState;

    // Analyze existing instruments
    const analysis = {
      instrumentTypes: this.analyzeInstrumentTypes(instruments),
      genres: this.detectGenres(patterns, instruments),
      tempo: this.detectTempo(projectState),
      key: this.detectKey(patterns),
      density: this.analyzeDensity(patterns),
      frequencyRange: this.analyzeFrequencyRange(instruments)
    };

    // Generate suggestions
    const suggestions = this.generateSuggestions(analysis);

    return {
      analysis,
      suggestions
    };
  }

  /**
   * Analyze instrument types in project
   */
  analyzeInstrumentTypes(instruments) {
    const types = {
      drums: [],
      bass: [],
      leads: [],
      pads: [],
      percussion: [],
      other: []
    };

    instruments.forEach(instrument => {
      const name = instrument.name.toLowerCase();
      
      if (this.isDrums(name)) types.drums.push(instrument.id);
      else if (this.isBass(name)) types.bass.push(instrument.id);
      else if (this.isLead(name)) types.leads.push(instrument.id);
      else if (this.isPad(name)) types.pads.push(instrument.id);
      else if (this.isPercussion(name)) types.percussion.push(instrument.id);
      else types.other.push(instrument.id);
    });

    return types;
  }

  /**
   * Detect genre from patterns and instruments
   */
  detectGenres(patterns, instruments) {
    const genres = [];
    const instrumentNames = instruments.map(i => i.name.toLowerCase()).join(' ');

    // Genre detection based on instrument names and patterns
    if (instrumentNames.includes('kick') && instrumentNames.includes('808')) {
      genres.push('hip-hop', 'trap');
    }
    if (instrumentNames.includes('house') || instrumentNames.includes('four-on-the-floor')) {
      genres.push('house');
    }
    if (instrumentNames.includes('techno') || instrumentNames.includes('acid')) {
      genres.push('techno');
    }
    if (instrumentNames.includes('ambient') || instrumentNames.includes('pad')) {
      genres.push('ambient');
    }
    if (instrumentNames.includes('dubstep') || instrumentNames.includes('wobble')) {
      genres.push('dubstep');
    }

    return genres.length > 0 ? genres : ['electronic'];
  }

  /**
   * Detect tempo from arrangement
   */
  detectTempo(projectState) {
    // TODO: Get tempo from arrangement store
    return 120; // Default 120 BPM
  }

  /**
   * Detect key from patterns
   */
  detectKey(patterns) {
    // Simple key detection (can be enhanced)
    return 'C'; // Default to C major
  }

  /**
   * Analyze pattern density
   */
  analyzeDensity(patterns) {
    // Calculate average notes per pattern
    const totalNotes = Object.values(patterns).reduce((sum, pattern) => {
      const patternNotes = Object.values(pattern.data || {}).flat();
      return sum + patternNotes.length;
    }, 0);
    
    const patternCount = Object.keys(patterns).length;
    return patternCount > 0 ? totalNotes / patternCount : 0;
  }

  /**
   * Analyze frequency range
   */
  analyzeFrequencyRange(instruments) {
    // Simple frequency range analysis
    return {
      low: instruments.some(i => this.isBass(i.name)),
      mid: instruments.some(i => this.isLead(i.name) || this.isPad(i.name)),
      high: instruments.some(i => this.isPercussion(i.name))
    };
  }

  /**
   * Generate suggestions based on analysis
   */
  generateSuggestions(analysis) {
    const suggestions = [];

    // Bass suggestions
    if (analysis.instrumentTypes.bass.length === 0) {
      suggestions.push({
        type: 'bass',
        priority: 'high',
        prompts: [
          "deep analog bass synth",
          "warm sub bass with reverb",
          "punchy 808 bass",
          "growling bass with distortion"
        ],
        reason: "No bass instruments detected"
      });
    }

    // Lead suggestions
    if (analysis.instrumentTypes.leads.length === 0) {
      suggestions.push({
        type: 'lead',
        priority: 'medium',
        prompts: [
          "bright lead synth",
          "warm pad sound",
          "pluck lead with delay",
          "arpeggiated lead"
        ],
        reason: "No lead instruments detected"
      });
    }

    // Drum suggestions
    if (analysis.instrumentTypes.drums.length === 0) {
      suggestions.push({
        type: 'drums',
        priority: 'high',
        prompts: [
          "deep 808 kick drum",
          "tight snare drum",
          "bright hi-hat",
          "crash cymbal"
        ],
        reason: "No drum instruments detected"
      });
    }

    // Genre-based suggestions
    if (analysis.genres.includes('house')) {
      suggestions.push({
        type: 'percussion',
        priority: 'medium',
        prompts: [
          "house kick drum",
          "shaker pattern",
          "hi-hat pattern",
          "clap with reverb"
        ],
        reason: "House genre detected"
      });
    }

    if (analysis.genres.includes('hip-hop') || analysis.genres.includes('trap')) {
      suggestions.push({
        type: 'bass',
        priority: 'high',
        prompts: [
          "deep 808 bass",
          "sub bass",
          "punchy kick",
          "trap hi-hat"
        ],
        reason: "Hip-hop/Trap genre detected"
      });
    }

    // Frequency range suggestions
    if (!analysis.frequencyRange.low) {
      suggestions.push({
        type: 'bass',
        priority: 'high',
        prompts: [
          "deep low-end bass",
          "sub bass",
          "808 kick"
        ],
        reason: "Missing low frequencies"
      });
    }

    if (!analysis.frequencyRange.high) {
      suggestions.push({
        type: 'percussion',
        priority: 'low',
        prompts: [
          "bright hi-hat",
          "shaker",
          "tambourine"
        ],
        reason: "Missing high frequencies"
      });
    }

    return suggestions;
  }

  // Helper methods
  isDrums(name) {
    return /kick|snare|drum|hat|hihat|crash|ride|tom|perc/.test(name);
  }

  isBass(name) {
    return /bass|808|sub|low/.test(name);
  }

  isLead(name) {
    return /lead|synth|pluck|arpeggio/.test(name);
  }

  isPad(name) {
    return /pad|ambient|atmosphere|string/.test(name);
  }

  isPercussion(name) {
    return /shaker|tambourine|clap|snap/.test(name);
  }
}

export const projectAnalyzer = new ProjectAnalyzer();

