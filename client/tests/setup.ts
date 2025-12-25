import '@testing-library/jest-dom';

// Mock Web Audio API for tests
class MockAudioContext {
    createGain() {
        return { connect: () => { }, gain: { value: 1 } };
    }
    createDynamicsCompressor() {
        return { connect: () => { } };
    }
    createAnalyser() {
        return { connect: () => { } };
    }
    resume() {
        return Promise.resolve();
    }
    close() {
        return Promise.resolve();
    }
}

// @ts-ignore
global.AudioContext = MockAudioContext;
// @ts-ignore
global.webkitAudioContext = MockAudioContext;

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
