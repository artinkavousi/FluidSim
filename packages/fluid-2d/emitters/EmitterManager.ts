/**
 * @package fluid-2d/emitters
 * EmitterManager - Manages emitter lifecycle and splat generation
 */

import type { Splat, Vec2, Color3 } from '../types';
import type {
  Emitter,
  EmitterType,
  BaseEmitter,
  SelectionState,
  EmitterChangeListener,
  SelectionChangeListener,
  EmitterManagerAPI,
  DirectionMode,
  TextEmitter,
  SVGEmitter,
  BrushEmitter,
} from './types';
import { Transform2D } from './Transform2D';
import { sampleTextPath } from './TextEmitter';
import { parseSVGPath, sampleSVGPath } from './SVGEmitter';

function clamp01(v: number): number {
  if (!isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

// ============================================
// EmitterManager Class
// ============================================

export class EmitterManager implements EmitterManagerAPI {
  private emitters: Map<string, Emitter> = new Map();
  private transforms: Map<string, Transform2D> = new Map();
  private idCounter = 0;
  private emissionAccumulator: Map<string, number> = new Map();

  // Selection state
  private selection: SelectionState = {
    primary: null,
    emitterIds: new Set(),
  };

  // Event listeners
  private changeListeners: Set<EmitterChangeListener> = new Set();
  private selectionListeners: Set<SelectionChangeListener> = new Set();

  // ============================================
  // ID Generation
  // ============================================

  private generateId(): string {
    return `emitter_${++this.idCounter}`;
  }

  // ============================================
  // CRUD Operations
  // ============================================

  addEmitter(config: Omit<Emitter, 'id'>): string {
    const id = this.generateId();
    const emitter = { ...config, id } as Emitter;

    this.emitters.set(id, emitter);
    this.transforms.set(id, new Transform2D(
      emitter.position,
      emitter.rotation,
      emitter.scale
    ));

    this.notifyChange();
    return id;
  }

  /**
   * Add an emitter with a specific ID (used for undo/redo)
   */
  addEmitterWithId(emitter: Emitter): void {
    // Update idCounter to avoid conflicts
    const numericId = parseInt(emitter.id.replace('emitter_', ''), 10);
    if (!isNaN(numericId) && numericId >= this.idCounter) {
      this.idCounter = numericId;
    }

    this.emitters.set(emitter.id, { ...emitter });
    this.transforms.set(emitter.id, new Transform2D(
      emitter.position,
      emitter.rotation,
      emitter.scale
    ));

    this.notifyChange();
  }

  removeEmitter(id: string): boolean {
    if (!this.emitters.has(id)) return false;

    this.emitters.delete(id);
    this.transforms.delete(id);
    this.emissionAccumulator.delete(id);

    // Remove from selection
    if (this.selection.emitterIds.has(id)) {
      this.selection.emitterIds.delete(id);
      if (this.selection.primary === id) {
        this.selection.primary = this.selection.emitterIds.size > 0
          ? [...this.selection.emitterIds][0]
          : null;
      }
      this.notifySelectionChange();
    }

    this.notifyChange();
    return true;
  }

  updateEmitter(id: string, updates: Partial<Emitter>): void {
    const emitter = this.emitters.get(id);
    if (!emitter) return;

    const updated = { ...emitter, ...updates } as Emitter;
    this.emitters.set(id, updated);

    // Update transform if position/rotation/scale changed
    if (updates.position || updates.rotation !== undefined || updates.scale) {
      const transform = this.transforms.get(id);
      if (transform) {
        if (updates.position) transform.setPosition(updates.position);
        if (updates.rotation !== undefined) transform.setRotation(updates.rotation);
        if (updates.scale) transform.setScale(updates.scale);
      }
    }

    this.notifyChange();
  }

  getEmitter(id: string): Emitter | undefined {
    return this.emitters.get(id);
  }

  getAllEmitters(): Emitter[] {
    return Array.from(this.emitters.values());
  }

  getActiveEmitters(): Emitter[] {
    return this.getAllEmitters().filter(e => e.active);
  }

  // ============================================
  // Selection
  // ============================================

  select(id: string, additive: boolean = false): void {
    if (!this.emitters.has(id)) return;

    if (!additive) {
      this.selection.emitterIds.clear();
    }

    this.selection.emitterIds.add(id);
    this.selection.primary = id;
    this.notifySelectionChange();
  }

  deselect(): void {
    this.selection.emitterIds.clear();
    this.selection.primary = null;
    this.notifySelectionChange();
  }

  toggleSelection(id: string): void {
    if (this.selection.emitterIds.has(id)) {
      this.selection.emitterIds.delete(id);
      if (this.selection.primary === id) {
        this.selection.primary = this.selection.emitterIds.size > 0
          ? [...this.selection.emitterIds][0]
          : null;
      }
    } else {
      this.selection.emitterIds.add(id);
      this.selection.primary = id;
    }
    this.notifySelectionChange();
  }

  getSelection(): SelectionState {
    return {
      primary: this.selection.primary,
      emitterIds: new Set(this.selection.emitterIds),
    };
  }

  // ============================================
  // Transform
  // ============================================

  setEmitterPosition(id: string, x: number, y: number): void {
    const transform = this.transforms.get(id);
    const emitter = this.emitters.get(id);
    if (!transform || !emitter) return;

    const nx = clamp01(x);
    const ny = clamp01(y);
    transform.setPosition([nx, ny]);
    (emitter as BaseEmitter).position = [nx, ny];
    this.notifyChange();
  }

  setEmitterRotation(id: string, degrees: number): void {
    const transform = this.transforms.get(id);
    const emitter = this.emitters.get(id);
    if (!transform || !emitter) return;

    transform.setRotation(degrees);
    (emitter as BaseEmitter).rotation = degrees;
    this.notifyChange();
  }

  setEmitterScale(id: string, sx: number, sy: number): void {
    const transform = this.transforms.get(id);
    const emitter = this.emitters.get(id);
    if (!transform || !emitter) return;

    transform.setScale([sx, sy]);
    (emitter as BaseEmitter).scale = [sx, sy];
    this.notifyChange();
  }

  getWorldTransform(id: string): import('../types').Transform2D | null {
    const transform = this.transforms.get(id);
    if (!transform) return null;

    return {
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    };
  }

  getTransform(id: string): Transform2D | null {
    return this.transforms.get(id) || null;
  }

  // ============================================
  // Splat Generation
  // ============================================

  generateSplats(time: number, dt: number, audioData?: Float32Array): Splat[] {
    const splats: Splat[] = [];

    for (const emitter of this.getActiveEmitters()) {
      const emitterSplats = this.generateEmitterSplats(emitter, time, dt, audioData);
      if (emitterSplats.length) splats.push(...emitterSplats);
    }

    return splats;
  }

  private generateEmitterSplats(
    emitter: Emitter,
    time: number,
    dt: number,
    audioData?: Float32Array
  ): Splat[] {
    if (!emitter.active) return [];

    // Calculate audio multipliers
    const audio = this.calculateAudioMultipliers(emitter, audioData);

    // Emission rate is bursts-per-second. A "burst" is one call to the emitter's shape sampler.
    const bursts = this.consumeEmissionBursts(emitter.id, (emitter.emissionRate ?? 0) * audio.emission, dt);
    if (bursts <= 0) return [];

    const out: Splat[] = [];
    const burstDt = dt > 0 && bursts > 0 ? dt / bursts : 0;

    for (let i = 0; i < bursts; i++) {
      const t = time + i * burstDt;

      switch (emitter.type) {
        case 'point':
          out.push(...this.generatePointSplats(emitter, t, audio));
          break;
        case 'line':
          out.push(...this.generateLineSplats(emitter, t, audio));
          break;
        case 'circle':
          out.push(...this.generateCircleSplats(emitter, t, audio));
          break;
        case 'curve':
          out.push(...this.generateCurveSplats(emitter, t, audio));
          break;
        case 'text':
          out.push(...this.generateTextSplats(emitter, t, audio));
          break;
        case 'svg':
          out.push(...this.generateSVGSplats(emitter, t, audio));
          break;
        case 'brush':
          out.push(...this.generateBrushSplats(emitter, t, audio));
          break;
        default:
          break;
      }
    }

    return out;
  }

  private consumeEmissionBursts(id: string, burstsPerSecond: number, dt: number): number {
    if (!isFinite(burstsPerSecond) || burstsPerSecond <= 0 || !isFinite(dt) || dt <= 0) {
      this.emissionAccumulator.set(id, 0);
      return 0;
    }

    const prev = this.emissionAccumulator.get(id) ?? 0;
    const next = prev + burstsPerSecond * dt;
    const bursts = Math.floor(next);
    this.emissionAccumulator.set(id, next - bursts);

    // Hard safety cap so a single slider can't freeze the app.
    return Math.max(0, Math.min(256, bursts));
  }

  private calculateAudioMultipliers(
    emitter: Emitter,
    audioData?: Float32Array
  ): { force: number; radius: number; emission: number } {
    const multipliers = { force: 1, radius: 1, emission: 1 };

    if (!emitter.audioReactive || !emitter.audioConfig?.enabled || !audioData) {
      return multipliers;
    }

    const config = emitter.audioConfig;
    const band = Math.min(config.band, audioData.length - 1);
    const amplitude = band >= 0 ? audioData[band] : 0;
    const level = amplitude * config.sensitivity;

    if (config.targets.force) {
      const [min, max] = config.forceRange;
      multipliers.force = min + level * (max - min);
    }

    if (config.targets.radius) {
      const [min, max] = config.radiusRange;
      multipliers.radius = min + level * (max - min);
    }

    if (config.targets.emission) {
      const [min, max] = config.emissionRange;
      multipliers.emission = min + level * (max - min);
    }

    return multipliers;
  }

  // ============================================
  // Emitter-Specific Splat Generation
  // ============================================

  private generatePointSplats(
    emitter: Emitter & { type: 'point' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform) return [];

    const pos = transform.position;
    const dir = this.resolveDirection(emitter, pos, [0, 1]);

    // Apply spread
    const spreadRad = (emitter.spread || 0) * Math.PI / 180;
    const angle = Math.atan2(dir[1], dir[0]) + (Math.random() - 0.5) * spreadRad;

    const force = emitter.force * emitter.forceScale * audio.force;
    const dx = Math.cos(angle) * force;
    const dy = Math.sin(angle) * force;

    return [this.applySplatOverrides(emitter, {
      x: pos[0],
      y: pos[1],
      dx,
      dy,
      color: emitter.color,
      radius: emitter.radius * emitter.radiusScale * audio.radius,
      opacity: emitter.opacity,
    })];
  }

  private generateLineSplats(
    emitter: Emitter & { type: 'line' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform) return [];

    const splats: Splat[] = [];
    const segments = emitter.segments || 10;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Interpolate along line
      const localX = emitter.start[0] + (emitter.end[0] - emitter.start[0]) * t;
      const localY = emitter.start[1] + (emitter.end[1] - emitter.start[1]) * t;

      // Transform to world
      const worldPos = transform.transformPoint(localX, localY);

      // Direction perpendicular to line
      const lineDir: Vec2 = [
        emitter.end[0] - emitter.start[0],
        emitter.end[1] - emitter.start[1],
      ];
      const len = Math.sqrt(lineDir[0] * lineDir[0] + lineDir[1] * lineDir[1]) || 1;
      const perpDir: Vec2 = [-lineDir[1] / len, lineDir[0] / len];

      const dir = this.resolveDirection(emitter, worldPos, perpDir);
      const force = emitter.force * emitter.forceScale * audio.force;

      // Gradient color
      let color = emitter.color;
      if (emitter.gradient) {
        color = this.lerpColor(emitter.gradient.startColor, emitter.gradient.endColor, t);
      }

      splats.push(this.applySplatOverrides(emitter, {
        x: worldPos[0],
        y: worldPos[1],
        dx: dir[0] * force,
        dy: dir[1] * force,
        color,
        radius: emitter.radius * emitter.radiusScale * audio.radius,
        opacity: emitter.opacity,
      }));
    }

    return splats;
  }

  private generateCircleSplats(
    emitter: Emitter & { type: 'circle' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform) return [];

    const splats: Splat[] = [];
    const points = emitter.points || 8;
    const [arcStart, arcEnd] = emitter.arc;
    const arcStartRad = arcStart * Math.PI / 180;
    const arcEndRad = arcEnd * Math.PI / 180;

    for (let i = 0; i < points; i++) {
      const t = i / points;
      const angle = arcStartRad + t * (arcEndRad - arcStartRad);

      // Position on circle
      const radius = emitter.outerRadius;
      const localX = Math.cos(angle) * radius;
      const localY = Math.sin(angle) * radius;

      const worldPos = transform.transformPoint(localX, localY);

      // Direction (inward or outward)
      const dirSign = emitter.inward ? -1 : 1;
      const dir: Vec2 = [Math.cos(angle) * dirSign, Math.sin(angle) * dirSign];

      const resolvedDir = this.resolveDirection(emitter, worldPos, dir);
      const force = emitter.force * emitter.forceScale * audio.force;

      splats.push(this.applySplatOverrides(emitter, {
        x: worldPos[0],
        y: worldPos[1],
        dx: resolvedDir[0] * force,
        dy: resolvedDir[1] * force,
        color: emitter.color,
        radius: emitter.radius * emitter.radiusScale * audio.radius,
        opacity: emitter.opacity,
      }));
    }

    return splats;
  }

  private generateCurveSplats(
    emitter: Emitter & { type: 'curve' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform || emitter.controlPoints.length < 2) return [];

    const splats: Splat[] = [];
    const samples = emitter.samples || 16;

    for (let i = 0; i <= samples; i++) {
      let t = i / samples;

      // Animate emission point
      if (emitter.animationSpeed > 0) {
        t = (t + time * emitter.animationSpeed) % 1;
      }

      const pos = this.evaluateCurve(emitter, t);
      const tangent = this.getCurveTangent(emitter, t);

      const worldPos = transform.transformPoint(pos[0], pos[1]);

      // Direction perpendicular to tangent
      const perpDir: Vec2 = [-tangent[1], tangent[0]];
      const dir = this.resolveDirection(emitter, worldPos, perpDir);
      const force = emitter.force * emitter.forceScale * audio.force;

      // Gradient color
      let color = emitter.color;
      if (emitter.gradient) {
        color = this.lerpColor(emitter.gradient.startColor, emitter.gradient.endColor, t);
      }

      splats.push(this.applySplatOverrides(emitter, {
        x: worldPos[0],
        y: worldPos[1],
        dx: dir[0] * force,
        dy: dir[1] * force,
        color,
        radius: emitter.radius * emitter.radiusScale * audio.radius,
        opacity: emitter.opacity,
      }));
    }

    return splats;
  }

  // Cache for text path samples
  private textPathCache: Map<string, Vec2[]> = new Map();

  private generateTextSplats(
    emitter: Emitter & { type: 'text' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform) return [];

    // Generate cache key based on text configuration
    const cacheKey = `${emitter.text}_${emitter.fontFamily}_${emitter.fontSize}_${emitter.fontWeight}_${emitter.samples}_${emitter.outline}`;

    // Get or create cached path points
    let pathPoints = this.textPathCache.get(cacheKey);
    if (!pathPoints) {
      pathPoints = sampleTextPath(
        emitter.text,
        emitter.fontFamily,
        emitter.fontSize,
        emitter.fontWeight,
        emitter.samples,
        emitter.outline
      );
      this.textPathCache.set(cacheKey, pathPoints);
    }

    if (pathPoints.length === 0) return [];

    const splats: Splat[] = [];
    const force = emitter.force * emitter.forceScale * audio.force;
    const baseRadius = emitter.radius * emitter.radiusScale * audio.radius;

    // Get emitter bounds for proper positioning
    // Text path points are normalized 0-1 within the text bounds
    // We need to map them to world space centered on emitter position
    const textScale = 0.3; // Scale factor to control text size in world space

    for (let i = 0; i < pathPoints.length; i++) {
      const pathPt = pathPoints[i];

      // Center the text around the emitter position
      // pathPt is 0-1 normalized, center it (-0.5 to 0.5) and scale
      const localX = (pathPt[0] - 0.5) * textScale;
      const localY = (pathPt[1] - 0.5) * textScale;

      // Apply emitter transform
      const worldPos = transform.transformPoint(localX, localY);

      // Calculate direction based on mode
      // For text, normal direction points outward from text center
      const defaultDir: Vec2 = [
        pathPt[0] - 0.5,
        pathPt[1] - 0.5
      ];
      const dir = this.resolveDirection(emitter, worldPos, this.normalizeVec2(defaultDir));

      // Apply spread
      const spreadRad = (emitter.spread || 0) * Math.PI / 180;
      const angle = Math.atan2(dir[1], dir[0]) + (Math.random() - 0.5) * spreadRad;

      splats.push(this.applySplatOverrides(emitter, {
        x: worldPos[0],
        y: worldPos[1],
        dx: Math.cos(angle) * force,
        dy: Math.sin(angle) * force,
        color: emitter.color,
        radius: baseRadius,
        opacity: emitter.opacity,
      }));
    }

    return splats;
  }

  // Cache for SVG path samples
  private svgPathCache: Map<string, Vec2[]> = new Map();

  private generateSVGSplats(
    emitter: Emitter & { type: 'svg' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform) return [];

    // Generate cache key
    const cacheKey = `${emitter.svgPath}_${emitter.samples}_${emitter.normalizeSize}`;

    // Get or create cached path points
    let pathPoints = this.svgPathCache.get(cacheKey);
    if (!pathPoints) {
      pathPoints = sampleSVGPath(
        emitter.svgPath,
        emitter.samples,
        emitter.normalizeSize
      );
      this.svgPathCache.set(cacheKey, pathPoints);
    }

    if (pathPoints.length === 0) return [];

    const splats: Splat[] = [];
    const force = emitter.force * emitter.forceScale * audio.force;
    const baseRadius = emitter.radius * emitter.radiusScale * audio.radius;

    for (let i = 0; i < pathPoints.length; i++) {
      const pathPt = pathPoints[i];

      // Apply emitter transform
      const worldPos = transform.transformPoint(pathPt[0], pathPt[1]);

      // Calculate normal direction (outward from center for SVG)
      const defaultDir: Vec2 = [pathPt[0], pathPt[1]];
      const normalizedDir = this.normalizeVec2(defaultDir);
      const dir = this.resolveDirection(emitter, worldPos,
        normalizedDir[0] === 0 && normalizedDir[1] === 0 ? [0, 1] : normalizedDir
      );

      // Apply spread
      const spreadRad = (emitter.spread || 0) * Math.PI / 180;
      const angle = Math.atan2(dir[1], dir[0]) + (Math.random() - 0.5) * spreadRad;

      splats.push(this.applySplatOverrides(emitter, {
        x: worldPos[0],
        y: worldPos[1],
        dx: Math.cos(angle) * force,
        dy: Math.sin(angle) * force,
        color: emitter.color,
        radius: baseRadius,
        opacity: emitter.opacity,
      }));
    }

    return splats;
  }

  private generateBrushSplats(
    emitter: Emitter & { type: 'brush' },
    time: number,
    audio: { force: number; radius: number; emission: number }
  ): Splat[] {
    const transform = this.transforms.get(emitter.id);
    if (!transform || emitter.strokes.length === 0) return [];

    const splats: Splat[] = [];
    const force = emitter.force * emitter.forceScale * audio.force;
    const baseRadius = emitter.radius * emitter.radiusScale * audio.radius;

    // Calculate total duration of all strokes
    let totalDuration = 0;
    for (const stroke of emitter.strokes) {
      totalDuration = Math.max(totalDuration, stroke.timestamp);
    }
    totalDuration = Math.max(totalDuration, 1); // Prevent division by zero

    // Calculate playback position
    let playbackTime = (time * emitter.playbackSpeed) % totalDuration;

    if (emitter.playbackMode === 'pingpong') {
      const cycle = Math.floor((time * emitter.playbackSpeed) / totalDuration);
      if (cycle % 2 === 1) {
        playbackTime = totalDuration - playbackTime;
      }
    } else if (emitter.playbackMode === 'once') {
      playbackTime = Math.min(time * emitter.playbackSpeed, totalDuration);
    }

    // Find strokes active at current playback time
    for (const stroke of emitter.strokes) {
      const strokeStart = stroke.timestamp;
      const strokeDuration = stroke.points.length * 0.016; // Assume ~60fps recording

      if (playbackTime >= strokeStart && playbackTime <= strokeStart + strokeDuration) {
        const strokeProgress = (playbackTime - strokeStart) / strokeDuration;
        const pointIndex = Math.floor(strokeProgress * (stroke.points.length - 1));

        // Get current and next points for direction
        const pt = stroke.points[pointIndex];
        const nextPt = stroke.points[Math.min(pointIndex + 1, stroke.points.length - 1)];
        const pressure = stroke.pressure[pointIndex] || 1;

        // Transform to world space
        const worldPos = transform.transformPoint(pt[0] - 0.5, pt[1] - 0.5);

        // Direction from movement
        const dx = nextPt[0] - pt[0];
        const dy = nextPt[1] - pt[1];
        const moveDir: Vec2 = this.normalizeVec2([dx, dy]);

        const dir = this.resolveDirection(emitter, worldPos, moveDir);

        // Apply spread
        const spreadRad = (emitter.spread || 0) * Math.PI / 180;
        const angle = Math.atan2(dir[1], dir[0]) + (Math.random() - 0.5) * spreadRad;

        splats.push(this.applySplatOverrides(emitter, {
          x: worldPos[0],
          y: worldPos[1],
          dx: Math.cos(angle) * force * pressure,
          dy: Math.sin(angle) * force * pressure,
          color: stroke.color,
          radius: baseRadius * emitter.brushSize * pressure,
          opacity: emitter.opacity * emitter.brushHardness,
        }));
      }
    }

    return splats;
  }

  private applySplatOverrides(emitter: Emitter, splat: Splat): Splat {
    // Inject temperature if configured on emitter
    const s: Splat = { ...splat };
    if (emitter.temperature !== undefined) {
      s.temperature = emitter.temperature;
    }

    const o = emitter.splatOverrides;
    if (!o) return s;

    return {
      ...s,
      splatFalloff: o.splatFalloff ?? s.splatFalloff,
      splatSoftness: o.splatSoftness ?? s.splatSoftness,
      splatBlendMode: o.blendMode ?? s.splatBlendMode,
      dyeScale: o.dyeIntensity ?? s.dyeScale,
      velocityScale: o.velocityScale ?? s.velocityScale,
      colorBoost: o.splatColorBoost ?? s.colorBoost,
    };
  }

  // ============================================
  // Direction Resolution
  // ============================================

  private resolveDirection(
    emitter: BaseEmitter,
    worldPos: Vec2,
    defaultDir: Vec2
  ): Vec2 {
    const mode = emitter.directionMode;

    switch (mode) {
      case 'fixed':
        return this.normalizeVec2(emitter.fixedDirection);
      case 'random':
        const angle = Math.random() * Math.PI * 2;
        return [Math.cos(angle), Math.sin(angle)];
      case 'normal':
      case 'tangent':
      case 'outward':
      case 'inward':
      default:
        return this.normalizeVec2(defaultDir);
    }
  }

  // ============================================
  // Curve Evaluation
  // ============================================

  private evaluateCurve(emitter: Emitter & { type: 'curve' }, t: number): Vec2 {
    const pts = emitter.controlPoints;

    switch (emitter.curveType) {
      case 'quadratic':
        if (pts.length >= 3) {
          return this.quadraticBezier(pts[0], pts[1], pts[2], t);
        }
        break;
      case 'cubic':
        if (pts.length >= 4) {
          return this.cubicBezier(pts[0], pts[1], pts[2], pts[3], t);
        }
        break;
      case 'catmull':
        if (pts.length >= 4) {
          return this.catmullRom(pts[0], pts[1], pts[2], pts[3], t);
        }
        break;
    }

    // Fallback: linear interpolation
    if (pts.length >= 2) {
      const idx = Math.min(Math.floor(t * (pts.length - 1)), pts.length - 2);
      const localT = t * (pts.length - 1) - idx;
      return [
        pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * localT,
        pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * localT,
      ];
    }

    return pts[0] || [0.5, 0.5];
  }

  private getCurveTangent(emitter: Emitter & { type: 'curve' }, t: number): Vec2 {
    const epsilon = 0.001;
    const p1 = this.evaluateCurve(emitter, Math.max(0, t - epsilon));
    const p2 = this.evaluateCurve(emitter, Math.min(1, t + epsilon));
    return this.normalizeVec2([p2[0] - p1[0], p2[1] - p1[1]]);
  }

  private quadraticBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
    const mt = 1 - t;
    return [
      mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
      mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
    ];
  }

  private cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return [
      mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0],
      mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1],
    ];
  }

  private catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
    const t2 = t * t;
    const t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
  }

  // ============================================
  // Utility Methods
  // ============================================

  private normalizeVec2(v: Vec2): Vec2 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    if (len < 1e-6) return [0, 1];
    return [v[0] / len, v[1] / len];
  }

  private lerpColor(a: Color3, b: Color3, t: number): Color3 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  // ============================================
  // Events
  // ============================================

  onChange(callback: EmitterChangeListener): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  onSelectionChange(callback: SelectionChangeListener): () => void {
    this.selectionListeners.add(callback);
    return () => this.selectionListeners.delete(callback);
  }

  private notifyChange(): void {
    const emitters = this.getAllEmitters();
    this.changeListeners.forEach(cb => cb(emitters));
  }

  private notifySelectionChange(): void {
    const selection = this.getSelection();
    this.selectionListeners.forEach(cb => cb(selection));
  }

  // ============================================
  // Utilities
  // ============================================

  clear(): void {
    this.emitters.clear();
    this.transforms.clear();
    this.selection = { primary: null, emitterIds: new Set() };
    this.notifyChange();
    this.notifySelectionChange();
  }

  duplicate(id: string): string | null {
    const emitter = this.emitters.get(id);
    if (!emitter) return null;

    const copy = { ...emitter };
    delete (copy as { id?: string }).id;
    (copy as BaseEmitter).name = `${emitter.name} (copy)`;
    (copy as BaseEmitter).position = [
      emitter.position[0] + 0.05,
      emitter.position[1] + 0.05,
    ];

    return this.addEmitter(copy as Omit<Emitter, 'id'>);
  }
}

// Export singleton-like factory
let defaultManager: EmitterManager | null = null;

export function getEmitterManager(): EmitterManager {
  if (!defaultManager) {
    defaultManager = new EmitterManager();
  }
  return defaultManager;
}

export function createEmitterManager(): EmitterManager {
  return new EmitterManager();
}
