import { useEffect, useRef, useState } from 'react';
import { sampleModelSurface, type SurfaceSample } from './constellation/sampling';
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

interface HorsePoints {
  positions: Float32Array;
  ranks: Float32Array;
}

const MODEL_URL = '/visuals/horse/horse.obj';
const MATERIAL_URL = '/visuals/horse/horse.mtl';
const TEXTURE_URL = '/visuals/horse/horse-texture-web.jpg';
const DESKTOP_BLUE_POINTS = 5200;
const MOBILE_BLUE_POINTS = 2600;

const vertexShaderSource = `
  precision mediump float;
  attribute vec3 aPosition;
  attribute vec2 aUv;
  attribute float aRank;
  uniform mat4 uMatrix;
  uniform float uProgress;
  uniform float uTime;
  uniform float uPointPass;
  uniform float uTailMin;
  uniform float uTailSpan;
  varying vec2 vUv;
  varying float vVisible;
  varying float vPulse;

  void main() {
    vec3 position = aPosition;
    float tailWeight = 1.0 - smoothstep(uTailMin, uTailMin + uTailSpan, position.z);
    position.y -= tailWeight * tailWeight * 0.075;
    position.x += tailWeight * tailWeight * 0.045 * sin(uTime * 1.15 + position.y * 12.0);
    gl_Position = uMatrix * vec4(position, 1.0);
    vUv = aUv;
    vVisible = step(aRank, uProgress);
    vPulse = 0.82 + 0.18 * sin(uTime * 1.7 + aRank * 93.0);
    gl_PointSize = mix(1.0, 4.4, uPointPass) * vPulse;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uPointPass;
  varying vec2 vUv;
  varying float vVisible;
  varying float vPulse;

  void main() {
    if (uPointPass > 0.5) {
      if (vVisible < 0.5) discard;
      vec2 point = gl_PointCoord - vec2(0.5);
      float distanceFromCenter = length(point);
      if (distanceFromCenter > 0.5) discard;
      float core = smoothstep(0.5, 0.05, distanceFromCenter);
      vec3 blue = mix(vec3(0.05, 0.36, 1.0), vec3(0.72, 0.94, 1.0), core);
      gl_FragColor = vec4(blue, (0.24 + core * 0.76) * vPulse);
      return;
    }

    vec4 textureColor = texture2D(uTexture, vec2(vUv.x, 1.0 - vUv.y));
    float luminance = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
    float blueMask = smoothstep(0.03, 0.18, textureColor.b - min(textureColor.r, textureColor.g));
    vec3 premiumBase = mix(vec3(0.018, 0.025, 0.045), textureColor.rgb, 0.82);
    premiumBase += vec3(0.01, 0.055, 0.12) * luminance;
    gl_FragColor = vec4(premiumBase, textureColor.a * blueMask * smoothstep(0.82, 1.0, uProgress) * 0.7);
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

function createSurfacePoints(samples: SurfaceSample[]): HorsePoints {
  const count = samples.length;
  const pointPositions = new Float32Array(count * 3);
  const pointRanks = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    pointPositions[index * 3] = samples[index].position.x;
    pointPositions[index * 3 + 1] = samples[index].position.y;
    pointPositions[index * 3 + 2] = samples[index].position.z;
    pointRanks[index] = samples[index].revealRank / Math.max(1, count - 1);
  }
  return { positions: pointPositions, ranks: pointRanks };
}

function createBlueTexturePredicate(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Unable to inspect horse texture');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  return ({ uv }: Pick<SurfaceSample, 'uv'>) => {
    const x = Math.min(canvas.width - 1, Math.max(0, Math.round(uv.x * (canvas.width - 1))));
    const y = Math.min(canvas.height - 1, Math.max(0, Math.round((1 - uv.y) * (canvas.height - 1))));
    const offset = (y * canvas.width + x) * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const saturation = blue - Math.min(red, green);
    return blue >= 72 && blue > red * 1.08 && blue >= green * 0.92 && saturation >= 12;
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

function createMatrix(center: [number, number, number], radius: number, angle: number, aspect: number) {
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
  const roll = -0.075;
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  progressRef.current = clamp01(progress);

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
      const pointTarget = window.innerWidth < 700 ? MOBILE_BLUE_POINTS : DESKTOP_BLUE_POINTS;
      const samples = await sampleModelSurface(MODEL_URL, {
        count: pointTarget,
        maxAttempts: pointTarget * 30,
        seed: duration > 0 ? 9137 : 4289,
        materialPath: MATERIAL_URL,
        normalize: false,
        acceptSample: createBlueTexturePredicate(image),
      });
      if (samples.length < 180) throw new Error('Horse texture contains too few blue surface samples');
      if (cancelled) return;
      const points = createSurfacePoints(samples);
      const program = createProgram(gl);
      const positionLocation = gl.getAttribLocation(program, 'aPosition');
      const uvLocation = gl.getAttribLocation(program, 'aUv');
      const rankLocation = gl.getAttribLocation(program, 'aRank');
      const matrixLocation = gl.getUniformLocation(program, 'uMatrix');
      const progressLocation = gl.getUniformLocation(program, 'uProgress');
      const timeLocation = gl.getUniformLocation(program, 'uTime');
      const pointPassLocation = gl.getUniformLocation(program, 'uPointPass');
      const tailMinLocation = gl.getUniformLocation(program, 'uTailMin');
      const tailSpanLocation = gl.getUniformLocation(program, 'uTailSpan');

      const trianglePositionBuffer = createBuffer(gl, geometry.positions);
      const triangleUvBuffer = createBuffer(gl, geometry.textureCoordinates);
      const triangleRanks = createBuffer(gl, new Float32Array(geometry.positions.length / 3));
      const pointPositionBuffer = createBuffer(gl, points.positions);
      const pointUvBuffer = createBuffer(gl, new Float32Array(points.ranks.length * 2));
      const pointRankBuffer = createBuffer(gl, points.ranks);

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
        const angle = preview ? -0.42 : ((now - startedAt) / 24000) * Math.PI * 2;
        const matrix = createMatrix(geometry.center, geometry.radius, angle, canvas.width / Math.max(1, canvas.height));
        gl.uniformMatrix4fv(matrixLocation, false, matrix);
        gl.uniform1f(progressLocation, progressRef.current);
        gl.uniform1f(timeLocation, now / 1000);
        gl.uniform1f(tailMinLocation, geometry.center[2] - geometry.radius);
        gl.uniform1f(tailSpanLocation, geometry.radius * 0.42);

        bindAttribute(positionLocation, trianglePositionBuffer, 3);
        bindAttribute(uvLocation, triangleUvBuffer, 2);
        bindAttribute(rankLocation, triangleRanks, 1);
        gl.uniform1f(pointPassLocation, 0);
        gl.depthMask(true);
        gl.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3);

        bindAttribute(positionLocation, pointPositionBuffer, 3);
        bindAttribute(uvLocation, pointUvBuffer, 2);
        bindAttribute(rankLocation, pointRankBuffer, 1);
        gl.uniform1f(pointPassLocation, 1);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        gl.drawArrays(gl.POINTS, 0, points.ranks.length);
        gl.depthMask(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
      <div className="horse-constellation__completion visual-finish-glow" aria-hidden="true" />
    </div>
  );
}
