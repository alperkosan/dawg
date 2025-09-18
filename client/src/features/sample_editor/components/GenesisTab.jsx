import React from 'react';
import { motion } from 'framer-motion';
import { Waves, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { useInstrumentsStore } from '../../../store/useInstrumentsStore';
import VolumeKnob from '../../../ui/VolumeKnob';
import WaveEnvelopeEditor from './WaveEnvelopeEditor'; // Yeni interaktif bileşenimiz
import EnhancedEffectsTab from './EnhancedEffectsTab';

const GenesisTab = (props) => {
  const { instrument } = props;
  const { updateInstrument } = useInstrumentsStore.getState();
  const envelope = instrument.envelope || { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1.0 };

  const handleEnvelopeChange = (newEnvelope) => {
    updateInstrument(instrument.id, { envelope: newEnvelope }, false);
  };
  
  const handleKnobChange = (param, value) => {
      const newEnvelope = { ...envelope, [param]: value };
      updateInstrument(instrument.id, { envelope: newEnvelope }, false);
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="w-full h-full flex flex-col lg:flex-row p-4 gap-4 bg-[var(--color-surface)] overflow-hidden"
    >
      {/* SOL TARAF / ÜST BÖLÜM: "ANA ODA" - SESİN DOĞUŞU */}
      <motion.div 
        variants={itemVariants}
        className="lg:flex-[3] bg-[var(--color-background)] rounded-lg shadow-lg p-4 flex flex-col gap-4"
      >
        <h2 className="text-lg font-bold text-[var(--color-primary)] flex items-center gap-2 shrink-0">
          <Waves size={20} /> Ana Oda: Dalga Formu & Zarf
        </h2>
        <div className="flex-grow min-h-0 relative">
          <WaveEnvelopeEditor 
            buffer={props.instrumentBuffer} 
            envelope={envelope} 
            onEnvelopeChange={handleEnvelopeChange}
          />
        </div>
        <div className="shrink-0 flex items-center justify-around p-2 bg-[var(--color-surface)] rounded-md">
            <VolumeKnob label="Attack" value={envelope.attack} onChange={(val) => handleKnobChange('attack', val)} min={0.001} max={2} defaultValue={0.01} />
            <VolumeKnob label="Decay" value={envelope.decay} onChange={(val) => handleKnobChange('decay', val)} min={0.001} max={2} defaultValue={0.1} />
            <VolumeKnob label="Sustain" value={envelope.sustain} onChange={(val) => handleKnobChange('sustain', val)} min={0} max={1} defaultValue={0.9} />
            <VolumeKnob label="Release" value={envelope.release} onChange={(val) => handleKnobChange('release', val)} min={0.001} max={5} defaultValue={1.0} />
        </div>
      </motion.div>

      {/* SAĞ TARAF / ALT BÖLÜM: "EFEKT ODASI" - SESİN İŞLENMESİ */}
      <motion.div 
        variants={itemVariants}
        className="lg:flex-[2] bg-[var(--color-background)] rounded-lg shadow-lg p-4 flex flex-col"
      >
        <h2 className="text-lg font-bold text-[var(--color-accent)] mb-2 flex items-center gap-2 shrink-0">
          <SlidersHorizontal size={20} /> Efekt Odası: Sinyal Zinciri
        </h2>
        <div className="flex-grow min-h-0">
          <EnhancedEffectsTab {...props} />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GenesisTab;