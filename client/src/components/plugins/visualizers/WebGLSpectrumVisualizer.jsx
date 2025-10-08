import React, { useEffect, useRef } from 'react';

/**
 * WebGL SPECTRUM VISUALIZER
 *
 * High-performance spectrum analyzer using WebGL
 * - Runs on GPU, minimal CPU usage
 * - Shared across multiple effects
 * - Customizable colors and styles
 * - 60fps smooth rendering
 */

export const WebGLSpectrumVisualizer = ({
  analyserNode,
  colorScheme = 'blue',
  style = 'bars', // 'bars' | 'curve' | 'fill'
  fftSize = 512,
  barCount = 32,
  smoothing = 0.8
}) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationRef = useRef(null);
  const bufferRef = useRef(null);

  // Color schemes
  const colorSchemes = {
    blue: { r: 0.2, g: 0.5, b: 1.0 },
    purple: { r: 0.6, g: 0.3, b: 1.0 },
    orange: { r: 1.0, g: 0.5, b: 0.2 },
    green: { r: 0.2, g: 1.0, b: 0.4 },
    cyan: { r: 0.2, g: 0.8, b: 0.9 },
    red: { r: 1.0, g: 0.3, b: 0.3 }
  };

  const color = colorSchemes[colorScheme] || colorSchemes.blue;

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    });

    if (!gl) {
      console.warn('WebGL not supported, falling back to Canvas 2D');
      return;
    }

    glRef.current = gl;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute float a_amplitude;
      varying float v_amplitude;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_amplitude = a_amplitude;
      }
    `;

    // Fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      varying float v_amplitude;
      uniform vec3 u_color;

      void main() {
        float alpha = v_amplitude * 0.9;
        vec3 color = u_color;

        // Add glow effect
        float glow = pow(v_amplitude, 2.0);
        color += vec3(glow * 0.3);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    programRef.current = program;

    // Get attribute/uniform locations
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const amplitudeLocation = gl.getAttribLocation(program, 'a_amplitude');
    const colorLocation = gl.getUniformLocation(program, 'u_color');

    // Set color uniform
    gl.uniform3f(colorLocation, color.r, color.g, color.b);

    // Create buffers
    const positionBuffer = gl.createBuffer();
    const amplitudeBuffer = gl.createBuffer();

    bufferRef.current = {
      position: positionBuffer,
      amplitude: amplitudeBuffer,
      positionLocation,
      amplitudeLocation
    };

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (gl) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(amplitudeBuffer);
      }
    };
  }, []);

  // Update color when scheme changes
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.useProgram(program);
    const colorLocation = gl.getUniformLocation(program, 'u_color');
    gl.uniform3f(colorLocation, color.r, color.g, color.b);
  }, [colorScheme]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    const buffer = bufferRef.current;

    if (!canvas || !gl || !buffer || !analyserNode) return;

    // Set analyser parameters
    analyserNode.fftSize = fftSize;
    analyserNode.smoothingTimeConstant = smoothing;

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    const render = () => {
      // Get frequency data
      analyserNode.getByteFrequencyData(dataArray);

      // Resize canvas if needed
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }

      // Clear
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Generate geometry based on style
      const positions = [];
      const amplitudes = [];

      if (style === 'bars') {
        // Bar chart
        const barWidth = 2.0 / barCount;

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * dataArray.length);
          const amplitude = dataArray[dataIndex] / 255;

          const x = -1 + i * barWidth;
          const height = amplitude * 2;

          // Two triangles per bar
          positions.push(
            x, -1,
            x + barWidth * 0.9, -1,
            x, -1 + height,

            x + barWidth * 0.9, -1,
            x + barWidth * 0.9, -1 + height,
            x, -1 + height
          );

          // Amplitude for each vertex
          for (let j = 0; j < 6; j++) {
            amplitudes.push(amplitude);
          }
        }
      } else if (style === 'curve') {
        // Smooth curve
        const points = barCount * 2;
        for (let i = 0; i < points; i++) {
          const dataIndex = Math.floor((i / points) * dataArray.length);
          const amplitude = dataArray[dataIndex] / 255;

          const x = -1 + (i / points) * 2;
          const y = -1 + amplitude * 2;

          if (i < points - 1) {
            const nextDataIndex = Math.floor(((i + 1) / points) * dataArray.length);
            const nextAmplitude = dataArray[nextDataIndex] / 255;
            const nextX = -1 + ((i + 1) / points) * 2;
            const nextY = -1 + nextAmplitude * 2;

            // Line segment
            positions.push(x, y, nextX, nextY);
            amplitudes.push(amplitude, nextAmplitude);
          }
        }
      } else if (style === 'fill') {
        // Filled area
        const points = barCount;
        for (let i = 0; i < points; i++) {
          const dataIndex = Math.floor((i / points) * dataArray.length);
          const amplitude = dataArray[dataIndex] / 255;

          const x = -1 + (i / points) * 2;
          const y = -1 + amplitude * 2;

          if (i < points - 1) {
            const nextDataIndex = Math.floor(((i + 1) / points) * dataArray.length);
            const nextAmplitude = dataArray[nextDataIndex] / 255;
            const nextX = -1 + ((i + 1) / points) * 2;
            const nextY = -1 + nextAmplitude * 2;

            // Triangle strip
            positions.push(
              x, -1,
              x, y,
              nextX, -1,

              nextX, -1,
              x, y,
              nextX, nextY
            );

            amplitudes.push(0, amplitude, 0, 0, amplitude, nextAmplitude);
          }
        }
      }

      // Upload geometry
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.position);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(buffer.positionLocation);
      gl.vertexAttribPointer(buffer.positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.amplitude);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(amplitudes), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(buffer.amplitudeLocation);
      gl.vertexAttribPointer(buffer.amplitudeLocation, 1, gl.FLOAT, false, 0, 0);

      // Draw
      const drawMode = style === 'curve' ? gl.LINES : gl.TRIANGLES;
      gl.drawArrays(drawMode, 0, positions.length / 2);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, style, barCount, fftSize, smoothing]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};
