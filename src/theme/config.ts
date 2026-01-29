/**
 * Theme Configuration
 * 
 * CHANGING COLORS:
 * 1. Update `colors` object below with your preferred Tailwind color palette
 * 2. All components use these semantic tokens, so changes propagate everywhere
 * 
 * COLOR PALETTE OPTIONS (Tailwind defaults):
 * - Greens: emerald, green, teal
 * - Blues: blue, sky, cyan, indigo
 * - Purples: purple, violet, fuchsia
 * - Reds: red, rose, pink
 * - Oranges: orange, amber, yellow
 * - Neutrals: slate, gray, zinc, neutral, stone
 */

// =============================================================================
// EDIT THESE TO CHANGE YOUR APP'S COLOR SCHEME
// =============================================================================
const colors = {
  // Primary brand color (buttons, links, focus rings)
  primary: 'emerald',
  
  // Accent color (secondary highlights)
  accent: 'teal',
  
  // Semantic colors
  success: 'emerald',
  warning: 'amber',
  danger: 'rose',
  
  // Neutral palette (backgrounds, borders, text)
  neutral: 'neutral',
} as const;

// =============================================================================
// THEME OBJECT (uses colors above)
// =============================================================================
export const theme = {
  product_name: 'My App',
  
  colors, // Export for reference
  
  modes: {
    default: 'dark',
    supports_dark: true,
  },
  
  icons: {
    set: 'lucide',
    default_size_px: 20,
  },
  
  layout: {
    container: 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
    topnav_height_px: 56,
    sidebar_expanded_px: 264,
    sidebar_collapsed_px: 72,
    content_gap: 'gap-4 sm:gap-6',
    radius: {
      card: 'rounded-2xl',
      button: 'rounded-xl',
      input: 'rounded-lg',
      pill: 'rounded-full',
    },
    shadow: {
      card: 'shadow-lg',
      elevated: 'shadow-xl',
      focus: 'ring-2 ring-offset-2',
    },
    motion: {
      duration_ms: 180,
      easing: 'ease-out',
    },
  },
  
  typography: {
    font_family: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica Neue, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji',
    scale: {
      h1: 'text-3xl sm:text-4xl',
      h2: 'text-2xl sm:text-3xl',
      h3: 'text-xl sm:text-2xl',
      body: 'text-base',
      small: 'text-sm',
      xs: 'text-xs',
    },
    weights: {
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
} as const;

// =============================================================================
// UTILITY FUNCTION
// =============================================================================
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// =============================================================================
// SEMANTIC COLOR TOKENS (auto-generated from colors above)
// =============================================================================
const c = colors; // shorthand

export const palette = {
  // Backgrounds
  bg: `bg-${c.neutral}-950`,
  bgSurface: `bg-${c.neutral}-900`,
  bgSurfaceAlt: `bg-${c.neutral}-800/60`,
  bgHover: `hover:bg-${c.neutral}-800/70`,
  bgActive: `bg-${c.neutral}-800`,
  
  // Borders
  border: `border-${c.neutral}-800`,
  borderLight: `border-${c.neutral}-700`,
  borderPrimary: `border-${c.primary}-500`,
  
  // Text
  text: `text-${c.neutral}-100`,
  textMuted: `text-${c.neutral}-400`,
  textSubtle: `text-${c.neutral}-500`,
  textInverse: 'text-white',
  
  // Primary (brand) colors
  primaryBg: `bg-${c.primary}-500`,
  primaryBgHover: `hover:bg-${c.primary}-400`,
  primaryText: `text-${c.primary}-400`,
  primaryTextHover: `hover:text-${c.primary}-300`,
  primaryBorder: `border-${c.primary}-500`,
  primaryRing: `ring-${c.primary}-400`,
  
  // Accent colors
  accentBg: `bg-${c.accent}-500`,
  accentBgHover: `hover:bg-${c.accent}-400`,
  accentText: `text-${c.accent}-400`,
  accentBorder: `border-${c.accent}-500/30`,
  accentBgSubtle: `bg-${c.accent}-500/5`,
  
  // Semantic: Success
  successBg: `bg-${c.success}-500`,
  successBgSubtle: `bg-${c.success}-900/20`,
  successText: `text-${c.success}-400`,
  successTextLight: `text-${c.success}-300`,
  successBorder: `border-${c.success}-500`,
  successBorderSubtle: `border-${c.success}-900/30`,
  
  // Semantic: Warning
  warningBg: `bg-${c.warning}-500`,
  warningBgSubtle: `bg-${c.warning}-900/20`,
  warningText: `text-${c.warning}-400`,
  warningTextLight: `text-${c.warning}-300`,
  warningBorder: `border-${c.warning}-500`,
  warningBorderSubtle: `border-${c.warning}-900/30`,
  
  // Semantic: Danger
  dangerBg: `bg-${c.danger}-600`,
  dangerBgHover: `hover:bg-${c.danger}-700`,
  dangerBgSubtle: `bg-${c.danger}-900/20`,
  dangerText: `text-${c.danger}-400`,
  dangerTextLight: `text-${c.danger}-300`,
  dangerBorder: `border-${c.danger}-600`,
  dangerBorderSubtle: `border-${c.danger}-900/30`,
  dangerRing: `ring-${c.danger}-500`,
  
  // Focus ring (consistent across app)
  focusRing: `focus:ring-2 focus:ring-${c.primary}-400 focus:ring-offset-2 focus:ring-offset-${c.neutral}-950`,
} as const;

// =============================================================================
// COMPONENT TOKENS (pre-built class combinations)
// =============================================================================
export const tokens = {
  // Layout
  layout: {
    container: theme.layout.container,
  },
  
  // Typography shortcuts
  typography: {
    scale: theme.typography.scale,
    weights: theme.typography.weights,
  },
  
  // Expose palette
  palette,
  
  // App shell
  app_shell: {
    grid: 'min-h-screen grid grid-cols-[auto_1fr]',
    content: 'min-w-0',
  },
  
  // Top navigation (mobile)
  topnav: {
    base: cn('flex items-center justify-between h-14 px-3 sm:px-4 border-b w-full max-w-full', palette.border, palette.bg),
    brand: cn('flex items-center gap-2 text-lg sm:text-xl font-semibold', palette.text),
    burger: cn('inline-flex items-center justify-center w-10 h-10 rounded-lg border sm:hidden', palette.border, palette.text, 'focus:outline-none', palette.focusRing),
    right: 'flex items-center gap-2',
  },
  
  // Sidebar (desktop)
  sidebar: {
    wrapper: cn('hidden sm:flex flex-col h-screen sticky top-0 border-r', palette.border),
    surface: palette.bg,
    collapsed: 'w-[72px]',
    expanded: 'w-[264px]',
    section_label: cn('px-3 pt-4 pb-2 text-xs uppercase tracking-wide', palette.textMuted),
    item_base: cn('flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors', `text-${c.neutral}-200`),
    item_hover: palette.bgHover,
    item_active: cn(palette.bgActive, 'text-white'),
    icon: 'shrink-0 w-5 h-5',
    label: cn('truncate', `text-${c.neutral}-200`),
    collapse_toggle: cn('absolute -right-3 top-16 z-10 w-6 h-6 rounded-full border flex items-center justify-center', palette.borderLight, palette.bgSurface, palette.textMuted),
    tooltip: cn('absolute left-full ml-2 px-2 py-1 text-xs rounded-md border shadow-lg', palette.borderLight, palette.bgSurface, palette.text),
  },
  
  // Mobile drawer
  mobile_drawer: {
    overlay: 'fixed inset-0 bg-black/40 sm:hidden',
    panel: cn('fixed inset-y-0 left-0 w-72 p-3 border-r sm:hidden', palette.bg, palette.border),
  },
  
  // Tab navigation
  tabs: {
    list: 'inline-flex flex-wrap gap-2',
    trigger: cn('px-3 py-1.5 border rounded-xl data-[active=true]:bg-opacity-70', palette.border, `text-${c.neutral}-200`, `data-[active=true]:${palette.bgSurfaceAlt}`),
    content: 'mt-3',
  },
  
  // Card
  card: {
    base: cn('rounded-2xl border p-4', palette.border, palette.bgSurface),
    muted: palette.bgSurface,
    highlighted: cn('rounded-2xl border p-4', palette.bgSurface, `border-${c.primary}-500/30`),
  },
  
  // Buttons
  button: {
    base: 'inline-flex items-center justify-center px-3 py-2 font-medium rounded-xl border transition focus:outline-none min-h-[40px] min-w-[40px]',
    primary: cn('text-white', palette.primaryBg, palette.primaryBorder, palette.primaryBgHover, palette.focusRing),
    success: cn('text-white', palette.successBg, palette.successBorder, `hover:bg-${c.success}-400`, palette.focusRing),
    secondary: cn(palette.text, palette.bgSurface, palette.border, palette.bgHover, palette.focusRing),
    ghost: cn(palette.text, 'bg-transparent border-transparent', palette.bgHover, palette.focusRing),
    danger: cn('text-white', palette.dangerBg, palette.dangerBorder, palette.dangerBgHover, `focus:ring-2 focus:ring-${c.danger}-500 focus:ring-offset-2 focus:ring-offset-${c.neutral}-950`),
    info: cn(palette.text, palette.accentBg, `border-${c.accent}-500`, `hover:bg-${c.accent}-400`, palette.focusRing),
  },
  
  // Inputs
  input: {
    base: cn('w-full px-3 py-2 border rounded-lg focus:outline-none', palette.bgSurface, palette.border, palette.text, `placeholder:${palette.textMuted}`, `caret-${c.primary}-400`),
    focus: palette.focusRing,
    date: cn('w-full px-3 py-2 border rounded-lg focus:outline-none', palette.bgSurface, palette.border, palette.text, `placeholder:${palette.textMuted}`, `caret-${c.primary}-400`, '[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert'),
  },
  
  // Select
  select: {
    wrapper: 'relative',
    base: cn('appearance-none w-full px-3 py-2 border rounded-lg pr-9 focus:outline-none', palette.bgSurface, palette.text, `placeholder:${palette.textMuted}`, palette.border, palette.focusRing),
    chevron: cn('pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4', palette.textMuted),
  },
  
  // Icons
  icon: {
    default: cn('w-4 h-4', palette.textMuted),
    inverse: palette.text,
  },
  
  // Table
  table: {
    wrapper: cn('overflow-x-auto rounded-2xl border max-w-full', palette.border),
    table: 'min-w-full text-sm',
    thead: cn('sticky top-0 z-10', palette.bgSurface),
    th: cn('text-left font-semibold px-4 py-2 border-b', palette.border, palette.text),
    tr_zebra: cn(`odd:${palette.bgSurface}`, palette.bgSurfaceAlt.replace('bg-', 'even:bg-')),
    td: cn('px-4 py-3 align-middle border-b', palette.border, palette.text),
    row_hover: palette.bgHover,
    empty_state: cn('p-8 text-center', palette.textMuted),
  },
  
  // Editable cells
  editable: {
    cell: cn('rounded-lg', `focus-within:ring-2 focus-within:ring-${c.primary}-400 focus-within:ring-offset-2 focus-within:ring-offset-${c.neutral}-950`),
    input: cn('w-full bg-transparent outline-none', palette.text, `placeholder:${palette.textSubtle}`),
  },
  
  // Badges
  badge: {
    base: 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
    neutral: cn(`bg-${c.neutral}-800`, `text-${c.neutral}-200`, palette.borderLight),
    success: cn(palette.successBgSubtle, palette.successTextLight, palette.successBorderSubtle),
    warning: cn(palette.warningBgSubtle, palette.warningTextLight, palette.warningBorderSubtle),
    danger: cn(palette.dangerBgSubtle, palette.dangerTextLight, palette.dangerBorderSubtle),
  },
  
  // Timer/Stat card
  timer: {
    card: cn('rounded-2xl border p-6 flex flex-col items-center justify-center text-center', palette.border, palette.bgSurface),
    time: cn('text-3xl sm:text-4xl font-semibold tracking-tight', palette.text),
    state: cn('mt-1', palette.textMuted),
    actions: 'mt-4 flex items-center gap-2',
  },
  
  // Modal
  modal: {
    overlay: 'fixed inset-0 bg-black/50 z-40',
    content: cn('fixed inset-x-0 top-20 mx-auto w-[min(600px,92%)] rounded-2xl border p-4 z-50', palette.border, palette.bgSurface),
  },
  
  // Toast
  toast: {
    base: 'fixed bottom-4 right-4 z-[1000] space-y-2',
  },
  
  // Common text styles
  text: {
    heading: cn(theme.typography.scale.h2, theme.typography.weights.bold, palette.text),
    subheading: cn(theme.typography.scale.h3, theme.typography.weights.semibold, palette.text),
    body: cn(theme.typography.scale.body, palette.text),
    muted: cn(theme.typography.scale.small, palette.textMuted),
    label: cn(theme.typography.scale.small, theme.typography.weights.medium, `text-${c.neutral}-200`),
  },
  
  // Link styles
  link: {
    primary: cn(palette.primaryText, palette.primaryTextHover),
    muted: cn(palette.textMuted, `hover:text-${c.neutral}-200`),
  },
  
  // Icon button (small, for toolbars)
  iconButton: {
    base: 'p-2 rounded-lg transition-colors',
    default: cn(palette.textMuted, `hover:${palette.text}`, palette.bgHover),
    danger: cn(palette.textMuted, `hover:${palette.dangerTextLight}`, palette.bgHover),
  },
} as const;

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility, maps to new structure)
// =============================================================================
export const legacyPalette = {
  light: {
    bg: 'bg-white',
    surface: 'bg-white',
    surface_alt: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-900',
    text_muted: 'text-slate-600',
    primary: `${c.primary}-600`,
    primary_hover: `${c.primary}-700`,
    accent: `${c.accent}-500`,
    success: `${c.success}-600`,
    warning: `${c.warning}-600`,
    danger: `${c.danger}-600`,
  },
  dark: {
    bg: palette.bg,
    surface: palette.bgSurface,
    surface_alt: palette.bgSurfaceAlt,
    border: palette.border,
    text: palette.text,
    text_muted: palette.textMuted,
    primary: `${c.primary}-500`,
    primary_hover: `${c.primary}-400`,
    accent: `${c.accent}-400`,
    success: `${c.success}-400`,
    warning: `${c.warning}-400`,
    danger: `${c.danger}-400`,
  },
};
