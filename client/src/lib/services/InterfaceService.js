import { TimelineSelectionAPI } from '../interfaces/TimelineSelectionAPI';
import { RealtimeParameterSync } from '../interfaces/RealtimeParameterSync';
import { DynamicLoopManager } from '../interfaces/DynamicLoopManager';
import EventBus from '../core/EventBus';

export class InterfaceService {
    static instance = null;

    static getInstance() {
        if (!this.instance) this.instance = new InterfaceService();
        return this.instance;
    }

    constructor() {
        this.timelineAPI = null;
        this.parameterSync = null;
        this.loopManager = null;
        this.eventBus = EventBus;
    }

    initialize(audioEngine) {
        if (!audioEngine) throw new Error('AudioEngine required');

        console.log('🔌 Initializing Interface Layer...');

        this.timelineAPI = new TimelineSelectionAPI(audioEngine, this.eventBus);
        this.parameterSync = new RealtimeParameterSync(audioEngine, this.eventBus);
        this.loopManager = new DynamicLoopManager(audioEngine, this.eventBus);

        this._setupEventForwarding(audioEngine);
        return this;
    }

    _setupEventForwarding(audioEngine) {
        // Forward transport events
        audioEngine.transport?.on('tick', data => this.eventBus.emit('transportTick', data));
        audioEngine.transport?.on('loop', data => {
            this.eventBus.emit('transportLoop', data);
            this.loopManager?.handleTransportLoop(data);
        });
        audioEngine.transport?.on('start', () => this.eventBus.emit('transportStart'));
        audioEngine.transport?.on('stop', () => this.eventBus.emit('transportStop'));

        // Forward Interface events
        this.eventBus.on('loopChanged', data => {
            if (audioEngine.callbacks?.onLoopChange) audioEngine.callbacks.onLoopChange(data);
        });
        this.eventBus.on('parameterChanged', data => {
            if (audioEngine.callbacks?.onParameterChange) audioEngine.callbacks.onParameterChange(data);
        });
    }

    // Expose APIs
    getTimeline() { return this.timelineAPI; }
    getParameters() { return this.parameterSync; }
    getLoopManager() { return this.loopManager; }
}
