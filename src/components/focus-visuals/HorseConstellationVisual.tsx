import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { FocusVisualProps } from './types';

interface HorseConstellationProps extends FocusVisualProps {
  duration: number;
}

interface HorseGeometry {
  positions: Float32Array;
  textureCoordinates: Float32Array;
  center: [number, number, number];
  radius: number;
}

interface CalibrationPoint {
  x: number;
  y: number;
}

const MODEL_URL = '/visuals/horse/horse.obj';
const TEXTURE_URL = '/visuals/horse/horse-texture-web.jpg';

const vertexShaderSource = `
  precision mediump float;
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat4 uMatrix;
  uniform float uProgress;
  uniform float uTime;
  varying vec2 vUv;
  varying vec4 vClipPosition;

  void main() {
    gl_Position = uMatrix * vec4(aPosition, 1.0);
    vClipPosition = gl_Position;
    vUv = aUv;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uTime;
  uniform float uCutEnabled;
  uniform vec2 uCutStart;
  uniform vec2 uCutEnd;
  uniform float uCutSide;
  varying vec2 vUv;
  varying vec4 vClipPosition;

  float hash(vec2 value) {
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 screenPosition = vClipPosition.xy / vClipPosition.w * 0.5 + 0.5;
    vec2 cutDirection = uCutEnd - uCutStart;
    float cutDistance = cutDirection.x * (screenPosition.y - uCutStart.y) - cutDirection.y * (screenPosition.x - uCutStart.x);
    if (uCutEnabled > 0.5 && cutDistance * uCutSide > 0.0) {
      discard;
    }

    vec4 textureColor = texture2D(uTexture, vec2(vUv.x, 1.0 - vUv.y));
    float blueStrength = textureColor.b - min(textureColor.r, textureColor.g);
    float blueMask = smoothstep(0.025, 0.14, blueStrength) * smoothstep(0.08, 0.3, textureColor.b);
    float revealOrder = clamp(vUv.y * 0.72 + hash(floor(vUv * 210.0)) * 0.28, 0.0, 1.0);
    float revealed = smoothstep(revealOrder - 0.025, revealOrder + 0.018, uProgress);
    float revealAge = max(0.0, uProgress - revealOrder);
    float ignition = revealed * (1.0 - smoothstep(0.0, 0.11, revealAge));
    float shimmer = 0.92 + 0.08 * sin(uTime * 2.1 + revealOrder * 71.0);
    vec3 glowColor = mix(textureColor.rgb, vec3(0.62, 0.9, 1.0), 0.82);
    vec3 finalColor = mix(textureColor.rgb, glowColor * shimmer, ignition);
    gl_FragColor = vec4(finalColor, textureColor.a * blueMask * revealed);
  }
`;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create horse shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Unable to compile horse shader');
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create horse program');
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Unable to link horse program');
  }
  return program;
}

function parseObj(source: string): HorseGeometry {
  const vertices: [number, number, number][] = [];
  const uvs: [number, number][] = [];
  const positions: number[] = [];
  const textureCoordinates: number[] = [];

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      vertices.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith('vt ')) {
      const [, u, v] = line.trim().split(/\s+/);
      uvs.push([Number(u), Number(v)]);
    } else if (line.startsWith('f ')) {
      const refs = line.trim().slice(2).split(/\s+/);
      for (let triangle = 1; triangle < refs.length - 1; triangle += 1) {
        for (const ref of [refs[0], refs[triangle], refs[triangle + 1]]) {
          const [vertexIndex, uvIndex] = ref.split('/').map(Number);
          const vertex = vertices[vertexIndex > 0 ? vertexIndex - 1 : vertices.length + vertexIndex];
          const uv = uvs[uvIndex > 0 ? uvIndex - 1 : uvs.length + uvIndex] ?? [0, 0];
          positions.push(...vertex);
          textureCoordinates.push(...uv);
        }
      }
    }
  }

  if (!vertices.length || !positions.length) throw new Error('Horse OBJ contains no renderable geometry');

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2;

  return {
    positions: new Float32Array(positions),
    textureCoordinates: new Float32Array(textureCoordinates),
    center,
    radius,
  };
}

function multiply(a: Float32Array, b: Float32Array) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function createMatrix(center: [number, number, number], radius: number, angle: number, aspect: number, tiltDegrees: number) {
  const scale = 0.88 / Math.max(radius, 0.0001);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const model = new Float32Array([
    cos * scale, 0, -sin * scale, 0,
    0, scale, 0, 0,
    sin * scale, 0, cos * scale, 0,
    -center[0] * cos * scale - center[2] * sin * scale,
    -center[1] * scale - 0.02,
    center[0] * sin * scale - center[2] * cos * scale,
    1,
  ]);
  const roll = tiltDegrees * Math.PI / 180;
  const rollCos = Math.cos(roll);
  const rollSin = Math.sin(roll);
  const projection = new Float32Array([
    rollCos / Math.max(aspect, 1), rollSin, 0, 0,
    -rollSin / Math.max(aspect, 1), rollCos, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
  return multiply(projection, model);
}

function createBuffer(gl: WebGLRenderingContext, data: BufferSource) {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Unable to create horse buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

export default function HorseConstellationVisual({ progress, duration }: HorseConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(clamp01(progress));
  const tiltRef = useRef(-4.3);
  const calibrationOpenRef = useRef(duration > 0);
  const cutStartRef = useRef<CalibrationPoint | null>(null);
  const cutEndRef = useRef<CalibrationPoint | null>(null);
  const cutSideRef = useRef(1);
  const [tiltDegrees, setTiltDegrees] = useState(-4.3);
  const [calibrationOpen, setCalibrationOpen] = useState(duration > 0);
  const [cutStart, setCutStart] = useState<CalibrationPoint | null>(null);
  const [cutEnd, setCutEnd] = useState<CalibrationPoint | null>(null);
  const [cutSide, setCutSide] = useState(1);
  const [drawingCut, setDrawingCut] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  progressRef.current = clamp01(progress);
  tiltRef.current = tiltDegrees;
  calibrationOpenRef.current = calibrationOpen;
  cutStartRef.current = cutStart;
  cutEndRef.current = cutEnd;
  cutSideRef.current = cutSide;

  function pointerPosition(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function startCut(event: ReactPointerEvent<HTMLDivElement>) {
    if (!calibrationOpen) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    setCutStart(point);
    setCutEnd(point);
    setDrawingCut(true);
  }

  function moveCut(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawingCut) setCutEnd(pointerPosition(event));
  }

  function saveCalibration() {
    const calibration = { tiltDegrees, cutStart, cutEnd, cutSide };
    console.info('[HorseCalibration]', JSON.stringify(calibration));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      setLoadState('error');
      return;
    }

    let cancelled = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;

    Promise.all([
      fetch(MODEL_URL).then((response) => {
        if (!response.ok) throw new Error('Unable to load horse model');
        return response.text();
      }),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to load horse texture'));
        image.src = TEXTURE_URL;
      }),
    ]).then(async ([objSource, image]) => {
      if (cancelled) return;
      const geometry = parseObj(objSource);
      const program = createProgram(gl);
      const positionLocation = gl.getAttribLocation(program, 'aPosition');
      const uvLocation = gl.getAttribLocation(program, 'aUv');
      const matrixLocation = gl.getUniformLocation(program, 'uMatrix');
      const progressLocation = gl.getUniformLocation(program, 'uProgress');
      const timeLocation = gl.getUniformLocation(program, 'uTime');
      const cutEnabledLocation = gl.getUniformLocation(program, 'uCutEnabled');
      const cutStartLocation = gl.getUniformLocation(program, 'uCutStart');
      const cutEndLocation = gl.getUniformLocation(program, 'uCutEnd');
      const cutSideLocation = gl.getUniformLocation(program, 'uCutSide');

      const trianglePositionBuffer = createBuffer(gl, geometry.positions);
      const triangleUvBuffer = createBuffer(gl, geometry.textureCoordinates);

      const texture = gl.createTexture();
      if (!texture) throw new Error('Unable to create horse texture');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([14, 30, 62, 255]));
      }

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      resize();

      const bindAttribute = (location: number, buffer: WebGLBuffer, size: number) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      };

      gl.useProgram(program);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const startedAt = performance.now();
      setLoadState('ready');

      const draw = (now: number) => {
        if (cancelled) return;
        frame = requestAnimationFrame(draw);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const preview = duration <= 0;
        const angle = preview || calibrationOpenRef.current ? -0.42 : ((now - startedAt) / 24000) * Math.PI * 2;
        const matrix = createMatrix(geometry.center, geometry.radius, angle, canvas.width / Math.max(1, canvas.height), tiltRef.current);
        gl.uniformMatrix4fv(matrixLocation, false, matrix);
        gl.uniform1f(progressLocation, progressRef.current);
        gl.uniform1f(timeLocation, now / 1000);
        const start = cutStartRef.current;
        const end = cutEndRef.current;
        gl.uniform1f(cutEnabledLocation, start && end ? 1 : 0);
        gl.uniform2f(cutStartLocation, start?.x ?? 0, 1 - (start?.y ?? 0));
        gl.uniform2f(cutEndLocation, end?.x ?? 0, 1 - (end?.y ?? 0));
        gl.uniform1f(cutSideLocation, cutSideRef.current);

        bindAttribute(positionLocation, trianglePositionBuffer, 3);
        bindAttribute(uvLocation, triangleUvBuffer, 2);
        gl.depthMask(true);
        gl.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3);
      };
      frame = requestAnimationFrame(draw);
    }).catch((error) => {
      console.error('Horse constellation failed to initialize', error);
      if (!cancelled) setLoadState('error');
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [duration]);

  const complete = progress >= 1;
  return (
    <div className={`horse-constellation focus-visual horse-constellation--${loadState} ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Horse constellation ${Math.round(progress * 100)} percent complete`}>
      <div className="horse-constellation__aura" aria-hidden="true" />
      <div className="horse-constellation__floor" aria-hidden="true" />
      <canvas ref={canvasRef} className="horse-constellation__canvas" aria-hidden="true" />
      {duration > 0 && (
        <div className={`horse-calibration-layer ${calibrationOpen ? 'horse-calibration-layer--open' : ''}`} onPointerDown={startCut} onPointerMove={moveCut} onPointerUp={() => setDrawingCut(false)}>
          {cutStart && cutEnd && (
            <svg className="horse-calibration-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1={cutStart.x * 100} y1={cutStart.y * 100} x2={cutEnd.x * 100} y2={cutEnd.y * 100} />
            </svg>
          )}
          {calibrationOpen && <div className="horse-calibration-panel" onPointerDown={(event) => event.stopPropagation()}>
            <div className="horse-calibration-title">Horse calibration</div>
            <label>tilt {tiltDegrees.toFixed(1)}deg<input type="range" min="-18" max="18" step="0.1" value={tiltDegrees} onChange={(event) => setTiltDegrees(Number(event.target.value))} /></label>
            <div className="horse-calibration-actions">
              <button type="button" onClick={() => setCutSide((side) => -side)}>Flip cut side</button>
              <button type="button" onClick={() => { setCutStart(null); setCutEnd(null); }}>Clear line</button>
              <button type="button" onClick={saveCalibration}>Save to console</button>
            </div>
            <div className="horse-calibration-hint">Drag over the horse to draw the tail cut line.</div>
          </div>}
          {!calibrationOpen && <button type="button" className="horse-calibration-open" onClick={(event) => { event.stopPropagation(); setCalibrationOpen(true); }}>Calibrate</button>}
        </div>
      )}
      <div className="horse-constellation__completion visual-finish-glow" aria-hidden="true" />
    </div>
  );
}
