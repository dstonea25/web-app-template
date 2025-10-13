// Theme configuration - mirrors /meta/style_profile.json
export const theme = {
  product_name: 'Geronimo',
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
  palette: {
    light: {
      bg: 'bg-white',
      surface: 'bg-white',
      surface_alt: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-900',
      text_muted: 'text-slate-600',
      primary: 'emerald-600',
      primary_hover: 'emerald-700',
      accent: 'teal-500',
      success: 'emerald-600',
      warning: 'amber-600',
      danger: 'rose-600',
    },
    dark: {
      bg: 'bg-neutral-950',
      surface: 'bg-neutral-900',
      surface_alt: 'bg-neutral-800/60',
      border: 'border-neutral-800',
      text: 'text-neutral-100',
      text_muted: 'text-neutral-400',
      primary: 'emerald-500',
      primary_hover: 'emerald-400',
      accent: 'teal-400',
      success: 'emerald-400',
      warning: 'amber-400',
      danger: 'rose-400',
    },
    focus_ring: {
      light: 'ring-emerald-500 ring-offset-white',
      dark: 'ring-emerald-400 ring-offset-neutral-950',
    },
  },
  typography: {
    font_family: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica Neue, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji',
    scale: {
      h1: 'text-3xl sm:text-4xl',
      h2: 'text-2xl sm:text-3xl',
      h3: 'text-xl sm:text-2xl',
      body: 'text-base',
      muted: 'text-sm',
    },
    weights: {
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
} as const;

// Utility function to combine class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Component tokens from style_profile.json
export const tokens = {
  layout: {
    container: theme.layout.container,
  },
  accent: {
    text_hover: 'hover:text-emerald-400',
  },
  typography: {
    scale: theme.typography.scale,
    weights: theme.typography.weights,
  },
  palette: theme.palette,
  app_shell: {
    grid: 'min-h-screen grid grid-cols-[auto_1fr]',
    content: 'min-w-0',
  },
  topnav: {
    base: 'flex items-center justify-between h-14 px-3 sm:px-4 border-b border-neutral-800 bg-neutral-950 w-full max-w-full',
    brand: 'flex items-center gap-2 text-lg sm:text-xl font-semibold text-neutral-100',
    burger: 'inline-flex items-center justify-center w-10 h-10 rounded-lg border border-neutral-800 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950 sm:hidden',
    right: 'flex items-center gap-2',
  },
  sidebar: {
    wrapper: 'hidden sm:flex flex-col h-screen sticky top-0 border-r border-neutral-800',
    surface: 'bg-neutral-950',
    collapsed: 'w-[72px]',
    expanded: 'w-[264px]',
    section_label: 'px-3 pt-4 pb-2 text-xs uppercase tracking-wide text-neutral-400',
    item_base: 'flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors text-neutral-200',
    item_hover: 'hover:bg-neutral-800/70',
    item_active: 'bg-neutral-800 text-white',
    icon: 'shrink-0 w-5 h-5',
    label: 'truncate text-neutral-200',
    collapse_toggle: 'absolute -right-3 top-16 z-10 w-6 h-6 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400 flex items-center justify-center',
    tooltip: 'absolute left-full ml-2 px-2 py-1 text-xs rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-lg',
  },
  mobile_drawer: {
    overlay: 'fixed inset-0 bg-black/40 sm:hidden',
    panel: 'fixed inset-y-0 left-0 w-72 p-3 bg-neutral-950 border-r border-neutral-800 sm:hidden',
  },
  tabs: {
    list: 'inline-flex flex-wrap gap-2',
    trigger: 'px-3 py-1.5 border border-neutral-800 rounded-xl data-[active=true]:bg-neutral-800/70 text-neutral-200',
    content: 'mt-3',
  },
  card: {
    base: 'rounded-2xl border border-neutral-800 p-4 bg-neutral-900',
    muted: 'bg-neutral-900',
  },
  button: {
    base: 'inline-flex items-center justify-center px-3 py-2 font-medium rounded-xl border transition focus:outline-none min-h-[40px] min-w-[40px]',
    primary: 'text-white bg-emerald-500 border-emerald-500 hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
    success: 'text-white bg-emerald-500 border-emerald-500 hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
    secondary: 'text-neutral-100 bg-neutral-900 border-neutral-800 hover:bg-neutral-800/70 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
    ghost: 'text-neutral-100 bg-transparent border-transparent hover:bg-neutral-800/70 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
    danger: 'text-white bg-rose-600 border-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-neutral-950',
    info: 'text-neutral-100 bg-teal-500 border-teal-500 hover:bg-teal-400 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
  },
  input: {
    base: 'w-full px-3 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-400 caret-emerald-400 focus:outline-none',
    focus: 'focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950',
    date: 'w-full px-3 py-2 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-400 caret-emerald-400 focus:outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100',
  },
  select: {
    wrapper: 'relative',
    base: 'appearance-none w-full px-3 py-2 border rounded-lg bg-neutral-900 text-neutral-100 placeholder:text-neutral-400 border-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950 pr-9',
    chevron: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400',
  },
  icon: {
    default: 'w-4 h-4 text-neutral-400',
    inverse: 'text-neutral-100',
  },
  table: {
    wrapper: 'overflow-x-auto rounded-2xl border border-neutral-800 max-w-full',
    table: 'min-w-full text-sm',
    thead: 'sticky top-0 z-10 bg-neutral-900',
    th: 'text-left font-semibold px-4 py-2 border-b border-neutral-800 text-neutral-100',
    tr_zebra: 'odd:bg-neutral-900 even:bg-neutral-800/60',
    td: 'px-4 py-3 align-middle border-b border-neutral-800 text-neutral-100',
    row_hover: 'hover:bg-neutral-800/70',
    empty_state: 'p-8 text-center text-neutral-400',
  },
  editable: {
    cell: 'focus-within:ring-2 focus-within:ring-emerald-400 focus-within:ring-offset-2 focus-within:ring-offset-neutral-950 rounded-lg',
    input: 'w-full bg-transparent outline-none text-neutral-100 placeholder:text-neutral-500',
  },
  badge: {
    base: 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
    neutral: 'bg-neutral-800 text-neutral-200 border-neutral-700',
    success: 'bg-emerald-900/20 text-emerald-300 border-emerald-900/30',
    warning: 'bg-amber-900/20 text-amber-300 border-amber-900/30',
    danger: 'bg-rose-900/20 text-rose-300 border-rose-900/30',
  },
  timer: {
    card: 'rounded-2xl border border-neutral-800 p-6 flex flex-col items-center justify-center text-center bg-neutral-900',
    time: 'text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-100',
    state: 'text-neutral-400 mt-1',
    actions: 'mt-4 flex items-center gap-2',
  },
  modal: {
    overlay: 'fixed inset-0 bg-black/50',
    content: 'fixed inset-x-0 top-20 mx-auto w-[min(600px,92%)] rounded-2xl border border-neutral-800 p-4 bg-neutral-900',
  },
  toast: {
    base: 'fixed bottom-4 right-4 z-[1000] space-y-2',
  },
  // Time tab specific styles
  time: {
    categoryPills: {
      container: 'flex items-center gap-2',
      pill: 'px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors',
      work: 'border-emerald-500 text-emerald-500 data-[active=true]:bg-emerald-500 data-[active=true]:text-white',
      personal: 'border-teal-400 text-teal-400 data-[active=true]:bg-teal-400 data-[active=true]:text-white',
      gaming: 'border-amber-400 text-amber-400 data-[active=true]:bg-amber-400 data-[active=true]:text-white'
    },
    timerCard: {
      wrapper: 'rounded-2xl border border-neutral-800 p-8 flex flex-col items-center justify-center text-center bg-neutral-900',
      time: 'text-6xl font-semibold tracking-tight text-neutral-100',
      state: 'mt-1 text-neutral-400',
      actions: 'mt-4 flex items-center gap-2'
    },
    pendingEditor: {
      row: 'mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,180px)_auto] gap-3 items-center',
      input: 'px-3 py-2 border border-neutral-800 rounded-lg bg-neutral-900 text-neutral-100',
      submit: 'btn btn-primary'
    },
    manualAdd: {
      wrapper: 'mt-6 rounded-2xl border border-neutral-800 p-4 bg-neutral-900',
      row: 'grid grid-cols-1 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_auto] gap-3',
      button: 'btn btn-primary'
    },
    filters: {
      range: 'flex items-center gap-2',
      category: 'flex items-center gap-2'
    },
    charts: {
      container: 'mt-6 grid gap-6',
      panel: 'rounded-2xl border border-neutral-800 p-4 bg-neutral-900',
      legend: 'flex items-center gap-3 text-sm text-neutral-400',
      seriesColors: {
        work: 'emerald-500',
        personal: 'teal-400',
        gaming: 'amber-400'
      }
    }
  },
} as const;

