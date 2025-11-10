/**
 * MIDIDeviceManager - Web MIDI API Integration
 *
 * Single source of truth for MIDI devices
 * - Device detection and management
 * - Input/output selection
 * - Real-time MIDI message handling
 * - Active note tracking
 *
 * Architecture:
 * - Singleton pattern
 * - Event-based (pub/sub)
 * - Performance optimized
 */

// ═══════════════════════════════════════════════════════════
// MIDI MESSAGE TYPES
// ═══════════════════════════════════════════════════════════

export const MIDI_MESSAGE_TYPE = {
    NOTE_OFF: 0x80,
    NOTE_ON: 0x90,
    POLY_AFTERTOUCH: 0xa0,
    CONTROL_CHANGE: 0xb0,
    PROGRAM_CHANGE: 0xc0,
    CHANNEL_AFTERTOUCH: 0xd0,
    PITCH_BEND: 0xe0,
    SYSTEM: 0xf0
};

// ═══════════════════════════════════════════════════════════
// MIDI DEVICE MANAGER
// ═══════════════════════════════════════════════════════════

export class MIDIDeviceManager {
    constructor() {
        this.state = {
            isSupported: false,
            isInitialized: false,
            devices: new Map(),
            selectedInputId: null,
            selectedOutputId: null,
            activeNotes: new Set(), // Currently held notes (pitch values)
            listeners: new Set(),
            midiAccess: null
        };

        // Performance tracking
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            lastMessageTime: 0
        };
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    /**
     * Initialize Web MIDI API
     */
    async initialize() {
        // Check browser support
        if (!navigator.requestMIDIAccess) {
            console.warn('🎹 Web MIDI API not supported in this browser');
            this.state.isSupported = false;
            return false;
        }

        try {
            // Request MIDI access
            const midiAccess = await navigator.requestMIDIAccess({ sysex: false });

            this.state.isSupported = true;
            this.state.isInitialized = true;
            this.state.midiAccess = midiAccess;

            // Listen for device connections/disconnections
            midiAccess.addEventListener('statechange', this.handleStateChange.bind(this));

            // Scan existing devices
            this.scanDevices(midiAccess);

            console.log('🎹 MIDI Device Manager initialized');
            console.log(`   Inputs: ${Array.from(midiAccess.inputs.values()).length}`);
            console.log(`   Outputs: ${Array.from(midiAccess.outputs.values()).length}`);

            return true;
        } catch (error) {
            console.error('🎹 MIDI initialization failed:', error);
            this.state.isSupported = false;
            this.state.isInitialized = false;
            return false;
        }
    }

    /**
     * Scan for MIDI devices
     */
    scanDevices(midiAccess) {
        // Clear existing devices
        this.state.devices.clear();

        // Scan inputs
        for (const input of midiAccess.inputs.values()) {
            this.state.devices.set(input.id, {
                id: input.id,
                name: input.name,
                manufacturer: input.manufacturer,
                type: 'input',
                state: input.state,
                connection: input.connection,
                midiInput: input
            });
        }

        // Scan outputs
        for (const output of midiAccess.outputs.values()) {
            this.state.devices.set(output.id, {
                id: output.id,
                name: output.name,
                manufacturer: output.manufacturer,
                type: 'output',
                state: output.state,
                connection: output.connection,
                midiOutput: output
            });
        }

        console.log(`🎹 Scanned ${this.state.devices.size} MIDI devices`);
    }

    /**
     * Handle device state changes (connect/disconnect)
     */
    handleStateChange(event) {
        const port = event.port;

        console.log(`🎹 MIDI device ${port.state}: ${port.name}`);

        if (port.state === 'connected') {
            // Add device
            this.state.devices.set(port.id, {
                id: port.id,
                name: port.name,
                manufacturer: port.manufacturer,
                type: port.type,
                state: port.state,
                connection: port.connection,
                [port.type === 'input' ? 'midiInput' : 'midiOutput']: port
            });
        } else if (port.state === 'disconnected') {
            // Remove device
            this.state.devices.delete(port.id);

            // If this was the selected device, clear selection
            if (port.id === this.state.selectedInputId) {
                this.state.selectedInputId = null;
            }
            if (port.id === this.state.selectedOutputId) {
                this.state.selectedOutputId = null;
            }
        }

        // Notify listeners
        this.notifyListeners({
            type: 'deviceStateChange',
            device: port,
            devices: Array.from(this.state.devices.values())
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DEVICE SELECTION
    // ═══════════════════════════════════════════════════════════

    /**
     * Select MIDI input device
     */
    selectInput(deviceId) {
        const device = this.state.devices.get(deviceId);

        if (!device || device.type !== 'input') {
            console.warn('🎹 Invalid MIDI input device:', deviceId);
            return false;
        }

        // Unsubscribe from previous device
        if (this.state.selectedInputId) {
            const prevDevice = this.state.devices.get(this.state.selectedInputId);
            if (prevDevice?.midiInput) {
                prevDevice.midiInput.onmidimessage = null;
            }
        }

        // Subscribe to new device
        this.state.selectedInputId = deviceId;
        device.midiInput.onmidimessage = this.handleMIDIMessage.bind(this);

        console.log('🎹 MIDI input selected:', device.name);

        // Notify listeners
        this.notifyListeners({
            type: 'inputSelected',
            device
        });

        return true;
    }

    /**
     * Select MIDI output device
     */
    selectOutput(deviceId) {
        const device = this.state.devices.get(deviceId);

        if (!device || device.type !== 'output') {
            console.warn('🎹 Invalid MIDI output device:', deviceId);
            return false;
        }

        this.state.selectedOutputId = deviceId;

        console.log('🎹 MIDI output selected:', device.name);

        // Notify listeners
        this.notifyListeners({
            type: 'outputSelected',
            device
        });

        return true;
    }

    /**
     * Auto-select first available input
     */
    autoSelectInput() {
        for (const device of this.state.devices.values()) {
            if (device.type === 'input' && device.state === 'connected') {
                this.selectInput(device.id);
                return true;
            }
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // MIDI MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════

    /**
     * Handle incoming MIDI message
     */
    handleMIDIMessage(event) {
        const [status, data1, data2] = event.data;
        const command = status & 0xf0;
        const channel = status & 0x0f;

        // Update stats
        this.stats.messagesReceived++;
        this.stats.lastMessageTime = event.timeStamp;

        // Parse MIDI message
        const midiEvent = {
            timestamp: event.timeStamp,
            command,
            channel,
            type: this.getMessageTypeName(command),
            rawData: event.data
        };

        // Add type-specific data
        switch (command) {
            case MIDI_MESSAGE_TYPE.NOTE_ON:
            case MIDI_MESSAGE_TYPE.NOTE_OFF:
                midiEvent.note = data1;
                midiEvent.velocity = data2;

                // Track active notes
                if (command === MIDI_MESSAGE_TYPE.NOTE_ON && data2 > 0) {
                    this.state.activeNotes.add(data1);
                } else {
                    this.state.activeNotes.delete(data1);
                }
                break;

            case MIDI_MESSAGE_TYPE.CONTROL_CHANGE:
                midiEvent.controller = data1;
                midiEvent.value = data2;
                break;

            case MIDI_MESSAGE_TYPE.PROGRAM_CHANGE:
                midiEvent.program = data1;
                break;

            case MIDI_MESSAGE_TYPE.PITCH_BEND:
                // Combine two 7-bit values into 14-bit pitch bend
                midiEvent.pitchBend = (data2 << 7) | data1;
                midiEvent.pitchBendNormalized = (midiEvent.pitchBend - 8192) / 8192; // -1 to 1
                break;

            case MIDI_MESSAGE_TYPE.CHANNEL_AFTERTOUCH:
                midiEvent.pressure = data1;
                break;

            case MIDI_MESSAGE_TYPE.POLY_AFTERTOUCH:
                midiEvent.note = data1;
                midiEvent.pressure = data2;
                break;
        }

        // Notify listeners
        this.notifyListeners(midiEvent);
    }

    /**
     * Get human-readable message type name
     */
    getMessageTypeName(command) {
        switch (command) {
            case MIDI_MESSAGE_TYPE.NOTE_OFF: return 'noteOff';
            case MIDI_MESSAGE_TYPE.NOTE_ON: return 'noteOn';
            case MIDI_MESSAGE_TYPE.POLY_AFTERTOUCH: return 'polyAftertouch';
            case MIDI_MESSAGE_TYPE.CONTROL_CHANGE: return 'controlChange';
            case MIDI_MESSAGE_TYPE.PROGRAM_CHANGE: return 'programChange';
            case MIDI_MESSAGE_TYPE.CHANNEL_AFTERTOUCH: return 'channelAftertouch';
            case MIDI_MESSAGE_TYPE.PITCH_BEND: return 'pitchBend';
            case MIDI_MESSAGE_TYPE.SYSTEM: return 'system';
            default: return 'unknown';
        }
    }

    /**
     * Send MIDI message to output
     */
    sendMessage(data, timestamp) {
        if (!this.state.selectedOutputId) {
            console.warn('🎹 No MIDI output selected');
            return false;
        }

        const device = this.state.devices.get(this.state.selectedOutputId);
        if (!device?.midiOutput) {
            console.warn('🎹 MIDI output not available');
            return false;
        }

        try {
            device.midiOutput.send(data, timestamp);
            this.stats.messagesSent++;
            return true;
        } catch (error) {
            console.error('🎹 Failed to send MIDI message:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LISTENER MANAGEMENT (PUB/SUB)
    // ═══════════════════════════════════════════════════════════

    /**
     * Subscribe to MIDI events
     */
    subscribe(listener) {
        this.state.listeners.add(listener);

        return () => {
            this.state.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners
     */
    notifyListeners(event) {
        this.state.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('🎹 Listener error:', error);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Get all devices
     */
    getDevices() {
        return Array.from(this.state.devices.values());
    }

    /**
     * Get input devices
     */
    getInputDevices() {
        return this.getDevices().filter(d => d.type === 'input');
    }

    /**
     * Get output devices
     */
    getOutputDevices() {
        return this.getDevices().filter(d => d.type === 'output');
    }

    /**
     * Get selected input device
     */
    getSelectedInput() {
        if (!this.state.selectedInputId) return null;
        return this.state.devices.get(this.state.selectedInputId);
    }

    /**
     * Get selected output device
     */
    getSelectedOutput() {
        if (!this.state.selectedOutputId) return null;
        return this.state.devices.get(this.state.selectedOutputId);
    }

    /**
     * Get currently active notes
     */
    getActiveNotes() {
        return Array.from(this.state.activeNotes);
    }

    /**
     * Check if MIDI is supported
     */
    isSupported() {
        return this.state.isSupported;
    }

    /**
     * Check if initialized
     */
    isInitialized() {
        return this.state.isInitialized;
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    // ═══════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════

    /**
     * Cleanup and disconnect
     */
    destroy() {
        // Unsubscribe from all devices
        for (const device of this.state.devices.values()) {
            if (device.midiInput) {
                device.midiInput.onmidimessage = null;
            }
        }

        // Clear state
        this.state.devices.clear();
        this.state.listeners.clear();
        this.state.activeNotes.clear();
        this.state.selectedInputId = null;
        this.state.selectedOutputId = null;

        console.log('🎹 MIDI Device Manager destroyed');
    }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════

let instance = null;

export function getMIDIDeviceManager() {
    if (!instance) {
        instance = new MIDIDeviceManager();
    }
    return instance;
}

export default getMIDIDeviceManager;
