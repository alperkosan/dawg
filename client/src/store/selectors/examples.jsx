/**
 * Example: Optimized Component Using Selectors
 * 
 * This shows how to migrate from inefficient to efficient Zustand subscriptions
 */

import React from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import {
    selectInstrumentById,
    selectInstrumentActions,
    shallow
} from '@/store/selectors/instrumentSelectors';

// ❌ BAD: Re-renders on ANY store change
function InstrumentRowBad({ instrumentId }) {
    const instruments = useInstrumentsStore(state => state.instruments);
    const instrument = instruments.find(i => i.id === instrumentId);
    const updateInstrument = useInstrumentsStore(state => state.updateInstrument);

    // This component re-renders when ANY instrument changes!
    return <div>{instrument?.name}</div>;
}

// ✅ GOOD: Only re-renders when THIS instrument changes
function InstrumentRowGood({ instrumentId }) {
    // Only subscribes to this specific instrument
    const instrument = useInstrumentsStore(selectInstrumentById(instrumentId));

    // Actions never cause re-renders
    const { updateInstrument } = useInstrumentsStore(selectInstrumentActions, shallow);

    // This component only re-renders when THIS instrument changes!
    return <div>{instrument?.name}</div>;
}

// ✅ BEST: Memoized component + optimized selectors
const InstrumentRowBest = React.memo(({ instrumentId }) => {
    const instrument = useInstrumentsStore(selectInstrumentById(instrumentId));
    const { updateInstrument } = useInstrumentsStore(selectInstrumentActions, shallow);

    return <div>{instrument?.name}</div>;
});

export { InstrumentRowBad, InstrumentRowGood, InstrumentRowBest };
