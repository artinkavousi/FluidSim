/**
 * @package studio/components
 * PerformanceHUD — Enhanced performance monitoring overlay
 * 
 * Displays FPS, frame time, per-pass GPU timing, and memory stats
 */

import React, { useState, useEffect, useRef } from 'react';

// ============================================
// Types
// ============================================

export interface PassTiming {
    id: string;
    ms: number;
    label?: string;
}

export interface FieldMemoryStats {
    fieldCount: number;
    totalBytes: number;
    byField: Map<string, number>;
}

export interface PerformanceHUDProps {
    fps: number;
    frameTime: number;
    passTimings?: PassTiming[];
    memoryStats?: FieldMemoryStats;
    visible?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================
// Utilities
// ============================================

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFPSColor(fps: number): string {
    if (fps >= 55) return '#22c55e';  // Green
    if (fps >= 30) return '#fbbf24';  // Yellow
    return '#ef4444';  // Red
}

function getPassColor(ms: number): string {
    if (ms < 1) return '#22c55e';
    if (ms < 4) return '#fbbf24';
    return '#ef4444';
}

// ============================================
// FPS Graph Component
// ============================================

const FPSGraph: React.FC<{ history: number[]; width?: number; height?: number }> = ({
    history,
    width = 100,
    height = 30,
}) => {
    const maxFps = 120;
    const points = history.map((fps, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - (Math.min(fps, maxFps) / maxFps) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg className="fps-graph" width={width} height={height}>
            <polyline
                fill="none"
                stroke="#00e5cc"
                strokeWidth="1.5"
                points={points}
            />
            <line x1="0" y1={height - (60 / maxFps) * height} x2={width} y2={height - (60 / maxFps) * height}
                stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
            <line x1="0" y1={height - (30 / maxFps) * height} x2={width} y2={height - (30 / maxFps) * height}
                stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
        </svg>
    );
};

// ============================================
// PerformanceHUD Component
// ============================================

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
    fps,
    frameTime,
    passTimings = [],
    memoryStats,
    visible = true,
    position = 'top-left',
}) => {
    const [expanded, setExpanded] = useState(false);
    const fpsHistoryRef = useRef<number[]>([]);

    useEffect(() => {
        fpsHistoryRef.current = [...fpsHistoryRef.current.slice(-49), fps];
    }, [fps]);

    if (!visible) return null;

    const positionStyles: Record<string, React.CSSProperties> = {
        'top-left': { top: 10, left: 10 },
        'top-right': { top: 10, right: 10 },
        'bottom-left': { bottom: 10, left: 10 },
        'bottom-right': { bottom: 10, right: 10 },
    };

    const totalPassTime = passTimings.reduce((sum, p) => sum + p.ms, 0);

    return (
        <div
            className={`performance-hud ${expanded ? 'expanded' : ''}`}
            style={positionStyles[position]}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Compact View */}
            <div className="hud-compact">
                <span className="hud-fps" style={{ color: getFPSColor(fps) }}>
                    {fps.toFixed(0)} FPS
                </span>
                <span className="hud-ft">{frameTime.toFixed(1)}ms</span>
            </div>

            {/* Expanded View */}
            {expanded && (
                <div className="hud-expanded">
                    {/* FPS Graph */}
                    <div className="hud-section">
                        <span className="hud-label">Frame Rate</span>
                        <FPSGraph history={fpsHistoryRef.current} />
                    </div>

                    {/* Pass Timings */}
                    {passTimings.length > 0 && (
                        <div className="hud-section">
                            <span className="hud-label">Pass Timing ({totalPassTime.toFixed(2)}ms)</span>
                            <div className="hud-passes">
                                {passTimings.slice(0, 10).map((pass, i) => (
                                    <div key={pass.id || i} className="hud-pass">
                                        <span className="pass-name">{pass.label || pass.id}</span>
                                        <span className="pass-bar" style={{
                                            width: `${Math.min(pass.ms / 4 * 100, 100)}%`,
                                            background: getPassColor(pass.ms)
                                        }} />
                                        <span className="pass-ms">{pass.ms.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Memory Stats */}
                    {memoryStats && (
                        <div className="hud-section">
                            <span className="hud-label">Memory</span>
                            <div className="hud-memory">
                                <span>Fields: {memoryStats.fieldCount}</span>
                                <span>Total: {formatBytes(memoryStats.totalBytes)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// CSS Styles
// ============================================

export const performanceHUDStyles = `
.performance-hud {
  position: fixed;
  z-index: 9999;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(8px);
  min-width: 80px;
  transition: all 0.2s ease;
}

.performance-hud.expanded {
  min-width: 200px;
}

.hud-compact {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hud-fps {
  font-weight: 600;
  font-size: 13px;
}

.hud-ft {
  color: #888;
}

.hud-expanded {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.hud-section {
  margin-bottom: 10px;
}

.hud-section:last-child {
  margin-bottom: 0;
}

.hud-label {
  display: block;
  color: #888;
  font-size: 10px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.fps-graph {
  display: block;
}

.hud-passes {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hud-pass {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 14px;
}

.pass-name {
  flex: 0 0 60px;
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}

.pass-bar {
  height: 8px;
  border-radius: 2px;
  min-width: 2px;
}

.pass-ms {
  flex: 0 0 35px;
  text-align: right;
  color: #666;
  font-size: 10px;
}

.hud-memory {
  display: flex;
  justify-content: space-between;
  color: #aaa;
}
`;
