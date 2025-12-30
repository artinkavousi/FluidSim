/**
 * @package studio/ui
 * Editorial Glassmorphism Theme - High-end magazine-inspired design
 */

// ============================================
// Color Palette - Editorial Slate
// ============================================

export const colors = {
  // Background - cool slate with depth
  bg: {
    primary: '#0f1115',
    secondary: 'rgba(18, 22, 28, 0.85)',
    tertiary: 'rgba(26, 32, 42, 0.8)',
    elevated: 'rgba(35, 42, 55, 0.75)',
    surface: 'rgba(45, 55, 72, 0.6)',
    canvas: '#080a0d',
  },
  
  // Glass effects - frosted luminosity
  glass: {
    light: 'rgba(255, 255, 255, 0.03)',
    medium: 'rgba(255, 255, 255, 0.06)',
    strong: 'rgba(255, 255, 255, 0.10)',
    ultraLight: 'rgba(255, 255, 255, 0.015)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    highlight: 'rgba(255, 255, 255, 0.15)',
  },
  
  // Accent - electric teal + warm coral
  accent: {
    primary: '#00e5cc',      // Electric teal
    primaryDark: '#00b3a0',
    primaryLight: '#5fffec',
    primaryGlow: 'rgba(0, 229, 204, 0.4)',
    primaryMuted: 'rgba(0, 229, 204, 0.15)',
    
    secondary: '#ff6b6b',    // Warm coral
    secondaryDark: '#e55555',
    secondaryLight: '#ff9999',
    secondaryGlow: 'rgba(255, 107, 107, 0.4)',
    
    tertiary: '#a78bfa',     // Soft violet
    tertiaryGlow: 'rgba(167, 139, 250, 0.4)',
    
    blue: '#60a5fa',
    blueGlow: 'rgba(96, 165, 250, 0.35)',
    
    amber: '#fbbf24',
    amberGlow: 'rgba(251, 191, 36, 0.35)',

    // Premium variants (used by Premium* components)
    gold: '#f6c454',
    goldLight: '#ffd58a',
    goldDark: '#c9a962',
    goldGlow: 'rgba(246, 196, 84, 0.35)',
    emerald: '#34d399',
    emeraldGlow: 'rgba(52, 211, 153, 0.35)',
    sapphire: '#3b82f6',
    sapphireGlow: 'rgba(59, 130, 246, 0.35)',
    ruby: '#f87171',
    
    white: '#ffffff',
    whiteGlow: 'rgba(255, 255, 255, 0.25)',
  },
  
  // Text - editorial hierarchy
  text: {
    headline: '#ffffff',
    primary: 'rgba(255, 255, 255, 0.92)',
    secondary: 'rgba(255, 255, 255, 0.68)',
    tertiary: 'rgba(255, 255, 255, 0.45)',
    muted: 'rgba(255, 255, 255, 0.28)',
    disabled: 'rgba(255, 255, 255, 0.15)',
    accent: '#00e5cc',
    inverse: '#0f1115',
  },
  
  // Borders
  border: {
    glass: 'rgba(255, 255, 255, 0.08)',
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.18)',
    focus: 'rgba(0, 229, 204, 0.6)',
    accentSubtle: 'rgba(0, 229, 204, 0.25)',
    goldSubtle: 'rgba(201, 169, 98, 0.25)',
  },
  
  // Status
  status: {
    success: '#00e5cc',
    warning: '#fbbf24',
    error: '#ff6b6b',
    info: '#60a5fa',
  },
  
  // Gradients
  gradient: {
    glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
    glassVertical: 'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)',
    accent: 'linear-gradient(135deg, #00e5cc 0%, #00b3a0 100%)',
    accentSubtle: 'linear-gradient(135deg, rgba(0, 229, 204, 0.2) 0%, rgba(0, 229, 204, 0.05) 100%)',
    editorial: 'linear-gradient(180deg, rgba(18, 22, 28, 0.95) 0%, rgba(15, 17, 21, 1) 100%)',
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)',
  },
} as const;

// ============================================
// Typography - Editorial System
// ============================================

export const typography = {
  fontFamily: {
    // Editorial display - geometric elegance
    display: '"Syne", "Space Grotesk", -apple-system, sans-serif',
    // Clean body
    body: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    // Monospace values
    mono: '"JetBrains Mono", "IBM Plex Mono", monospace',
    // Editorial accent
    editorial: '"Playfair Display", Georgia, serif',
  },
  
  fontSize: {
    '2xs': '9px',
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '32px',
    '5xl': '40px',
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
  
  lineHeight: {
    none: 1,
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.65,
  },
  
  letterSpacing: {
    tighter: '-0.03em',
    tight: '-0.015em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
    widest: '0.15em',
    editorial: '0.25em',
  },
} as const;

// ============================================
// Spacing System
// ============================================

export const spacing = {
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
} as const;

// ============================================
// Effects - Glassmorphism + Editorial
// ============================================

export const effects = {
  shadow: {
    none: 'none',
    sm: '0 2px 8px rgba(0, 0, 0, 0.25)',
    md: '0 4px 16px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.4)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.5)',
    glow: '0 0 24px rgba(0, 229, 204, 0.3)',
    glowStrong: '0 0 40px rgba(0, 229, 204, 0.5)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
    glass: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  
  blur: {
    none: 'none',
    sm: 'blur(4px)',
    md: 'blur(12px)',
    lg: 'blur(20px)',
    xl: 'blur(32px)',
    '2xl': 'blur(48px)',
    glass: 'blur(24px) saturate(150%)',
  },
  
  glassmorphism: {
    background: 'rgba(18, 22, 28, 0.75)',
    backgroundStrong: 'rgba(18, 22, 28, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderStrong: '1px solid rgba(255, 255, 255, 0.14)',
    blur: 'blur(24px) saturate(140%)',
    blurLight: 'blur(16px) saturate(120%)',
  },
  
  transition: {
    instant: '0.05s ease',
    fast: '0.12s ease',
    normal: '0.2s ease',
    smooth: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ============================================
// Border Radius
// ============================================

export const radius = {
  none: '0',
  xs: '3px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
} as const;

// ============================================
// Z-Index Scale
// ============================================

export const zIndex = {
  base: 0,
  above: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700,
} as const;

// ============================================
// Emitter Type Colors - Refined
// ============================================

export const emitterTypeColors: Record<string, { primary: string; glow: string; bg: string }> = {
  point: { 
    primary: '#00e5cc', 
    glow: 'rgba(0, 229, 204, 0.4)',
    bg: 'rgba(0, 229, 204, 0.12)',
  },
  line: { 
    primary: '#60a5fa', 
    glow: 'rgba(96, 165, 250, 0.4)',
    bg: 'rgba(96, 165, 250, 0.12)',
  },
  circle: { 
    primary: '#a78bfa', 
    glow: 'rgba(167, 139, 250, 0.4)',
    bg: 'rgba(167, 139, 250, 0.12)',
  },
  curve: { 
    primary: '#ff6b6b', 
    glow: 'rgba(255, 107, 107, 0.4)',
    bg: 'rgba(255, 107, 107, 0.12)',
  },
  text: { 
    primary: '#fbbf24', 
    glow: 'rgba(251, 191, 36, 0.4)',
    bg: 'rgba(251, 191, 36, 0.12)',
  },
  svg: { 
    primary: '#f472b6', 
    glow: 'rgba(244, 114, 182, 0.4)',
    bg: 'rgba(244, 114, 182, 0.12)',
  },
  brush: { 
    primary: '#34d399', 
    glow: 'rgba(52, 211, 153, 0.4)',
    bg: 'rgba(52, 211, 153, 0.12)',
  },
} as const;

// ============================================
// Component Presets
// ============================================

export const presets = {
  glassPanel: {
    background: effects.glassmorphism.background,
    backdropFilter: effects.glassmorphism.blur,
    border: effects.glassmorphism.border,
    borderRadius: radius.xl,
    boxShadow: effects.shadow.glass,
  },
  
  glassPanelStrong: {
    background: effects.glassmorphism.backgroundStrong,
    backdropFilter: effects.glassmorphism.blur,
    border: effects.glassmorphism.borderStrong,
    borderRadius: radius.xl,
    boxShadow: effects.shadow.lg,
  },
  
  input: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${colors.border.glass}`,
    borderFocus: `1px solid ${colors.border.focus}`,
    borderRadius: radius.md,
    height: '36px',
    padding: `0 ${spacing[3]}`,
  },
  
  button: {
    height: '36px',
    padding: `0 ${spacing[5]}`,
    borderRadius: radius.md,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  
  slider: {
    height: '4px',
    thumbSize: '14px',
    borderRadius: radius.full,
  },
} as const;

// ============================================
// Theme Export
// ============================================

export const theme = {
  colors,
  typography,
  spacing,
  effects,
  radius,
  zIndex,
  emitterTypeColors,
  presets,
} as const;

export type Theme = typeof theme;
export default theme;
