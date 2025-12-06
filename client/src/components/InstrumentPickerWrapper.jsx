/**
 * ✅ FIX: InstrumentPicker wrapper component
 * Handles instrument selection and calls ChannelRack's handleAddNewInstrument
 * via EventBus to avoid prop drilling
 */
import React, { useEffect } from 'react';
import { usePanelsStore } from '@/store/usePanelsStore';
import InstrumentPicker from '@/features/channel_rack/InstrumentPicker';
import EventBus from '@/lib/core/EventBus';

export function InstrumentPickerWrapper() {
  const isOpen = usePanelsStore(state => state.isInstrumentPickerOpen);
  const setOpen = usePanelsStore(state => state.setInstrumentPickerOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleInstrumentSelect = (instrumentData) => {
      // Emit event for ChannelRack to handle
      EventBus.emit('instrument-picker:select', instrumentData);
      setOpen(false);
    };

    EventBus.on('instrument-picker:select-internal', handleInstrumentSelect);

    return () => {
      EventBus.off('instrument-picker:select-internal', handleInstrumentSelect);
    };
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  return (
    <InstrumentPicker
      onSelectInstrument={(instrumentData) => {
        // Emit internal event that wrapper listens to
        EventBus.emit('instrument-picker:select-internal', instrumentData);
      }}
      onClose={() => setOpen(false)}
    />
  );
}








