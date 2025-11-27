const DEFAULT_PALETTE = {
  background: '#05080f',
  rail: '#0e141f',
  grid: '#1e2633',
  safe: '#22c55e',
  warn: '#eab308',
  hot: '#f59e0b',
  clip: '#ef4444',
  text: 'rgba(255,255,255,0.6)',
  glass: 'rgba(255,255,255,0.06)'
};

const PEAK_HOLD_DURATION = 2000; // ms
const PEAK_RELEASE_RATE = 30; // dB per second
const GHOST_DECAY_RATE = 50; // dB per second
const SCALE_TICKS = [12, 6, 3, 0, -3, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60];
const LABELED_SCALE_TICKS = new Set([12, 6, 3, 0, -3, -6, -12, -24, -36, -48, -60]);

const dbToPercent = (db) => {
  const clamped = Math.max(-60, Math.min(12, db));
  return (clamped + 60) / 72;
};

const getColor = (palette, db) => {
  if (db > 0) return palette.clip;
  if (db > -6) return palette.hot;
  if (db > -18) return palette.warn;
  return palette.safe;
};

export const mixerMeterRenderer = {
  create(initialState = {}, { markDirty }) {
    let state = {
      width: initialState.width || 24,
      height: initialState.height || 140,
      devicePixelRatio: initialState.devicePixelRatio || 1,
      palette: { ...DEFAULT_PALETTE, ...(initialState.palette || {}) },
      peak: -60,
      rms: -60,
      peakHold: -60,
      ghostTrail: -60,
      peakHoldTimestamp: 0,
      ghostTimestamp: 0,
      lastRenderTs: 0
    };

    const updateState = (nextState = {}) => {
      const nextPalette = nextState.palette
        ? { ...state.palette, ...nextState.palette }
        : state.palette;

      state = {
        ...state,
        ...nextState,
        palette: nextPalette
      };

      if (nextState.levels) {
        const { peak = -60, rms = -60, timestamp = performance.now() } = nextState.levels;
        state.peak = peak;
        state.rms = rms;

        if (peak >= state.peakHold || timestamp - state.peakHoldTimestamp > PEAK_HOLD_DURATION) {
          state.peakHold = peak;
          state.peakHoldTimestamp = timestamp;
        }

        if (peak >= state.ghostTrail) {
          state.ghostTrail = peak;
          state.ghostTimestamp = timestamp;
        }
      }

      markDirty();
    };

    const animateDynamics = (timestamp) => {
      const delta = state.lastRenderTs ? (timestamp - state.lastRenderTs) / 1000 : 0;
      let needsAnimation = false;

      if (timestamp - state.peakHoldTimestamp > PEAK_HOLD_DURATION && state.peakHold > state.peak) {
        const falloff = PEAK_RELEASE_RATE * delta;
        state.peakHold = Math.max(state.peak, state.peakHold - falloff);
        needsAnimation = true;
      }

      if (state.ghostTrail > state.peak) {
        const decay = GHOST_DECAY_RATE * delta;
        state.ghostTrail = Math.max(state.peak, state.ghostTrail - decay);
        needsAnimation = true;
      }

      state.lastRenderTs = timestamp;

      if (needsAnimation) {
        markDirty();
      }
    };

const drawScale = (ctx, palette, width, height, railX, railWidth) => {
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.text;
  const scaleStart = railX + railWidth + 6;
  const scaleEnd = width - 6;

      SCALE_TICKS.forEach((db) => {
        const y = height - dbToPercent(db) * height;
        const isMajor = db % 6 === 0;
        ctx.strokeStyle = isMajor ? palette.grid : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = isMajor ? 1.2 : 0.6;
        ctx.beginPath();
        ctx.moveTo(scaleStart, y);
        ctx.lineTo(scaleEnd, y);
        ctx.stroke();

        if (LABELED_SCALE_TICKS.has(db)) {
          ctx.fillText(db > 0 ? `+${db}` : db, scaleEnd - 18, y);
        }
      });
    };

    const render = (canvas, ctx, _ignoredState, timestamp = performance.now()) => {
      if (!canvas || !ctx) {
        return;
      }

      const dpr = state.devicePixelRatio || self.devicePixelRatio || 1;
      const width = typeof state.width === 'number' && state.width > 0 ? state.width : (canvas.width ? canvas.width / dpr : DEFAULT_WIDTH);
      const height = typeof state.height === 'number' && state.height > 0 ? state.height : (canvas.height ? canvas.height / dpr : DEFAULT_HEIGHT);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = Math.max(1, width * dpr);
        canvas.height = Math.max(1, height * dpr);
        if (canvas.style) {
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      animateDynamics(timestamp);

      ctx.fillStyle = state.palette.background;
      ctx.fillRect(0, 0, width, height);

      const railX = 8;
      const railWidth = width - 40;
      const railHeight = height - 12;
      const railY = 6;

      const backgroundGradient = ctx.createLinearGradient(0, railY + railHeight, 0, railY);
      backgroundGradient.addColorStop(0, state.palette.rail);
      backgroundGradient.addColorStop(0.45, '#0b1723');
      backgroundGradient.addColorStop(1, '#111f2f');
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(railX, railY, railWidth, railHeight);

      const levelGradient = ctx.createLinearGradient(0, railY + railHeight, 0, railY);
      levelGradient.addColorStop(0, state.palette.safe);
      levelGradient.addColorStop(0.55, state.palette.warn);
      levelGradient.addColorStop(0.85, state.palette.hot);
      levelGradient.addColorStop(1, state.palette.clip);

      const drawSegments = () => {
        for (let db = -60; db <= 12; db += 3) {
          const percent = dbToPercent(db);
          const y = railY + railHeight - percent * railHeight;
          const isMajor = db % 12 === 0;
          ctx.strokeStyle = isMajor ? state.palette.grid : 'rgba(255,255,255,0.05)';
          ctx.lineWidth = isMajor ? 1.4 : 0.7;
          ctx.beginPath();
          ctx.moveTo(railX + (isMajor ? 0 : 4), y);
          ctx.lineTo(railX + railWidth - (isMajor ? 0 : 4), y);
          ctx.stroke();
        }
      };

      drawSegments();

      const drawBar = (percent, color, options = {}) => {
        const { opacity = 1, inset = 0, glow = false } = options;
        const barHeight = percent * railHeight;
        const x = railX + inset;
        const widthPx = railWidth - inset * 2;
        const y = railY + railHeight - barHeight;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, widthPx, barHeight);
        if (glow) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fillRect(x, y - 1, widthPx, 3);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      };

      const peakPercent = dbToPercent(state.peak);
      const rmsPercent = dbToPercent(state.rms);
      const peakHoldPercent = dbToPercent(state.peakHold);
      const ghostPercent = dbToPercent(state.ghostTrail);

      const peakColor = getColor(state.palette, state.peak);
      const rmsColor = getColor(state.palette, state.rms);

      if (ghostPercent > 0) {
        drawBar(ghostPercent, peakColor, { opacity: 0.18, inset: 1 });
      }

      drawBar(rmsPercent, levelGradient, { opacity: 0.4, inset: 3 });

      drawBar(peakPercent, levelGradient, { opacity: 1, inset: 0.5, glow: state.peak >= -3 });

      if (peakHoldPercent > 0) {
        const y = railY + railHeight - peakHoldPercent * railHeight;
        ctx.strokeStyle = getColor(state.palette, state.peakHold);
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(railX, y);
        ctx.lineTo(railX + railWidth, y);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(railX + railWidth + 3, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const glassGradient = ctx.createLinearGradient(railX, railY, railX, railY + railHeight);
      glassGradient.addColorStop(0, 'rgba(255,255,255,0.12)');
      glassGradient.addColorStop(0.25, 'rgba(255,255,255,0.02)');
      glassGradient.addColorStop(0.75, 'rgba(255,255,255,0)');
      ctx.fillStyle = glassGradient;
      ctx.fillRect(railX, railY, railWidth, railHeight);

      drawScale(ctx, state.palette, width, height, railX, railWidth);

      ctx.restore();
    };

    return (canvas, ctx, nextState, timestamp) => {
      if (nextState) {
        const { width, height, devicePixelRatio, palette, levels } = nextState;
        updateState({
          width: width ?? state.width,
          height: height ?? state.height,
          devicePixelRatio: devicePixelRatio ?? state.devicePixelRatio,
          palette,
          levels
        });
      }
      render(canvas, ctx, state, timestamp);
    };
  }
};


