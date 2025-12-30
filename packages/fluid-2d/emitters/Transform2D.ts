/**
 * @package fluid-2d/emitters
 * Transform2D - 2D transformation matrix helper
 */

import type { Vec2 } from '../types';

export class Transform2D {
  position: Vec2;
  rotation: number;  // Degrees
  scale: Vec2;
  
  // Cached matrix values
  private _matrix: number[] | null = null;
  private _inverseMatrix: number[] | null = null;
  private _dirty = true;

  constructor(
    position: Vec2 = [0.5, 0.5],
    rotation: number = 0,
    scale: Vec2 = [1, 1]
  ) {
    this.position = [...position];
    this.rotation = rotation;
    this.scale = [...scale];
  }

  // ============================================
  // Setters (invalidate cache)
  // ============================================

  setPosition(position: Vec2): void {
    this.position = [...position];
    this._dirty = true;
  }

  setRotation(degrees: number): void {
    this.rotation = degrees;
    this._dirty = true;
  }

  setScale(scale: Vec2): void {
    this.scale = [...scale];
    this._dirty = true;
  }

  // ============================================
  // Matrix Computation
  // ============================================

  /**
   * Get the transformation matrix [a, b, c, d, tx, ty]
   * Transforms from local space to world space
   */
  getMatrix(): number[] {
    if (!this._dirty && this._matrix) {
      return this._matrix;
    }
    
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = this.scale[0];
    const sy = this.scale[1];
    
    // Combined rotation and scale matrix
    // [sx*cos, sx*sin, -sy*sin, sy*cos, tx, ty]
    this._matrix = [
      sx * cos,    // a
      sx * sin,    // b
      -sy * sin,   // c
      sy * cos,    // d
      this.position[0],  // tx
      this.position[1],  // ty
    ];
    
    this._dirty = false;
    this._inverseMatrix = null;
    
    return this._matrix;
  }

  /**
   * Get the inverse transformation matrix
   * Transforms from world space to local space
   */
  getInverseMatrix(): number[] {
    if (this._inverseMatrix) {
      return this._inverseMatrix;
    }
    
    const m = this.getMatrix();
    const [a, b, c, d, tx, ty] = m;
    
    // Determinant
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) {
      // Singular matrix, return identity
      this._inverseMatrix = [1, 0, 0, 1, 0, 0];
      return this._inverseMatrix;
    }
    
    const invDet = 1 / det;
    
    this._inverseMatrix = [
      d * invDet,      // a'
      -b * invDet,     // b'
      -c * invDet,     // c'
      a * invDet,      // d'
      (c * ty - d * tx) * invDet,  // tx'
      (b * tx - a * ty) * invDet,  // ty'
    ];
    
    return this._inverseMatrix;
  }

  // ============================================
  // Transform Operations
  // ============================================

  /**
   * Transform a point from local space to world space
   */
  transformPoint(x: number, y: number): Vec2 {
    const [a, b, c, d, tx, ty] = this.getMatrix();
    return [
      a * x + c * y + tx,
      b * x + d * y + ty,
    ];
  }

  /**
   * Transform a point from world space to local space
   */
  inverseTransformPoint(x: number, y: number): Vec2 {
    const [a, b, c, d, tx, ty] = this.getInverseMatrix();
    const dx = x - this.position[0];
    const dy = y - this.position[1];
    return [
      a * dx + c * dy,
      b * dx + d * dy,
    ];
  }

  /**
   * Transform a direction vector (ignores translation)
   */
  transformDirection(x: number, y: number): Vec2 {
    const [a, b, c, d] = this.getMatrix();
    return [
      a * x + c * y,
      b * x + d * y,
    ];
  }

  /**
   * Inverse transform a direction vector
   */
  inverseTransformDirection(x: number, y: number): Vec2 {
    const [a, b, c, d] = this.getInverseMatrix();
    return [
      a * x + c * y,
      b * x + d * y,
    ];
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Create a copy of this transform
   */
  clone(): Transform2D {
    return new Transform2D(
      [...this.position],
      this.rotation,
      [...this.scale]
    );
  }

  /**
   * Reset to identity transform
   */
  reset(): void {
    this.position = [0.5, 0.5];
    this.rotation = 0;
    this.scale = [1, 1];
    this._dirty = true;
  }

  /**
   * Get rotation in radians
   */
  getRotationRadians(): number {
    return this.rotation * Math.PI / 180;
  }

  /**
   * Set rotation from radians
   */
  setRotationRadians(radians: number): void {
    this.rotation = radians * 180 / Math.PI;
    this._dirty = true;
  }
}


