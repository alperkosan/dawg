const TapeEchoVisualizer = ({ delayTime, feedback, wet }) => {
  const canvasRef = useRef(null);
  const echoesRef = useRef([]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastSpawn = 0;
    
    class TapeEcho {
      constructor(x, amplitude) {
        this.x = x;
        this.amplitude = amplitude;
        this.life = 1;
        this.speed = 1;
      }
      
      update() {
        this.x += this.speed;
        this.life *= (0.99 + feedback * 0.008);
        this.amplitude *= this.life;
      }
      
      draw(ctx, height) {
        if (this.life < 0.01) return;
        
        ctx.strokeStyle = `rgba(255, 140, 0, ${this.life * wet})`;
        ctx.lineWidth = 2 + this.amplitude * 3;
        ctx.shadowColor = 'rgba(255, 140, 0, 0.5)';
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.moveTo(this.x, height/2 - this.amplitude * height * 0.3);
        ctx.lineTo(this.x, height/2 + this.amplitude * height * 0.3);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    const animate = (timestamp) => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Vintage tape background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(40, 20, 10, 0.9)');
      gradient.addColorStop(1, 'rgba(20, 10, 5, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Tape heads
      ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
      ctx.fillRect(50, height/2 - 20, 10, 40); // Record head
      ctx.fillRect(width - 80, height/2 - 20, 10, 40); // Playback head
      
      // Spawn new echoes
      if (timestamp - lastSpawn > delayTime * 100) {
        echoesRef.current.push(new TapeEcho(60, 0.5 + Math.random() * 0.5));
        lastSpawn = timestamp;
      }
      
      // Update and draw echoes
      echoesRef.current = echoesRef.current.filter(echo => {
        echo.update();
        echo.draw(ctx, height);
        return echo.x < width && echo.life > 0.01;
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate(0);
    return () => cancelAnimationFrame(animationFrameId);
  }, [delayTime, feedback, wet]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const FeedbackDelayUI = ({ effect, onChange }) => {
  const { delayTime, feedback, wet } = effect.settings;
  
  const timeOptions = [
    { value: '8n', label: '1/8' },
    { value: '8n.', label: '1/8D' },
    { value: '8t', label: '1/8T' },
    { value: '4n', label: '1/4' },
    { value: '4n.', label: '1/4D' },
    { value: '4t', label: '1/4T' },
    { value: '2n', label: '1/2' }
  ];
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-amber-200">Vintage Tape Echo</h2>
          <p className="text-xs text-amber-400">Analog Delay Simulation</p>
        </div>
        
        {/* Tape Speed Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-300">SPEED</span>
          <div className="w-12 h-6 bg-amber-900 rounded border">
            <div className="w-full h-full bg-amber-500 rounded animate-pulse opacity-80" />
          </div>
        </div>
      </div>
      
      {/* Tape Echo Visualization */}
      <div className="bg-black/40 rounded-xl p-4 mb-6 h-40 border border-amber-600/30">
        <TapeEchoVisualizer delayTime={delayTime} feedback={feedback} wet={wet} />
      </div>
      
      {/* Controls */}
      <div className="grid grid-cols-3 gap-6">
        {/* Time Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-amber-200">Delay Time</label>
          <select 
            value={delayTime} 
            onChange={(e) => onChange('delayTime', e.target.value)}
            className="w-full bg-black/50 border border-amber-500 rounded-lg p-3 text-white text-center font-mono"
          >
            {timeOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        
        <ProfessionalKnob 
          label="Feedback" 
          value={feedback * 100} 
          onChange={(v) => onChange('feedback', v / 100)} 
          min={0} max={95} defaultValue={40} 
          unit="%" precision={0} size={80}
        />
        
        <ProfessionalKnob 
          label="Mix" 
          value={wet * 100} 
          onChange={(v) => onChange('wet', v / 100)} 
          min={0} max={100} defaultValue={40} 
          unit="%" precision={0} size={80}
        />
      </div>
      
      {/* Vintage Controls */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {/* Tape Age */}
        <div className="bg-black/20 rounded-lg p-3 border border-amber-600/20">
          <div className="text-xs text-amber-300 mb-2">Tape Age</div>
          <div className="flex gap-2">
            {['New', 'Used', 'Worn'].map((age, i) => (
              <button
                key={age}
                className={`flex-1 py-1 text-xs rounded ${
                  i === 1 ? 'bg-amber-600 text-white' : 'bg-amber-900/50 text-amber-300'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>
        
        {/* Wow & Flutter */}
        <div className="bg-black/20 rounded-lg p-3 border border-amber-600/20">
          <div className="text-xs text-amber-300 mb-2">Wow & Flutter</div>
          <div className="w-full h-2 bg-amber-900 rounded">
            <div className="w-1/3 h-full bg-amber-500 rounded" />
          </div>
        </div>
        
        {/* Saturation */}
        <div className="bg-black/20 rounded-lg p-3 border border-amber-600/20">
          <div className="text-xs text-amber-300 mb-2">Saturation</div>
          <div className="w-full h-2 bg-amber-900 rounded">
            <div className="w-2/5 h-full bg-amber-500 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
};
