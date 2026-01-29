# Web App Template - Agent Guide

This template provides a production-ready foundation for React + Vite + Tailwind + Supabase web applications. Use this guide to understand the architecture and quickly build new features.

## Quick Start for Agents

When transforming this template into a new app:

1. **Update app identity** in `src/theme/config.ts` → change `product_name`
2. **Define your tabs** in `src/config/tabs.ts` → update `TAB_REGISTRY`
3. **Create page components** in `src/pages/` → one per tab
4. **Update AppShell.tsx** → import and render your pages
5. **Set up Supabase** → create tables, update `.env`
6. **Extend api.ts** → add your data fetching/saving functions

---

## Architecture Overview

```
src/
├── components/
│   ├── layout/           # Navigation infrastructure (don't modify)
│   │   ├── AppShell.tsx  # Main layout, tab switching, routing
│   │   ├── Sidebar.tsx   # Desktop navigation
│   │   ├── TopNav.tsx    # Mobile header
│   │   ├── TopBanner.tsx # Page title/subtitle
│   │   └── MobileDrawer.tsx
│   ├── ui/               # Reusable UI components
│   └── [feature]/        # Feature-specific components
├── pages/                # Tab page components
├── config/
│   └── tabs.ts           # Tab registry (THE source of truth for navigation)
├── theme/
│   └── config.ts         # Design tokens, colors, component styles
├── lib/
│   ├── api.ts            # API client, Supabase operations
│   ├── supabase.ts       # Supabase client initialization
│   └── auth.ts           # Authentication service
├── contexts/             # React contexts for global state
└── types/
    └── index.ts          # TypeScript interfaces
```

---

## How To: Add a New Tab/Page

### Step 1: Register the tab in `src/config/tabs.ts`

```typescript
export type AppTab = { 
  id: 'home' | 'your_tab_id';  // Add your tab ID to union type
  title: string; 
  route: string; 
  icon: string;   // Lucide icon name (lowercase)
  order: number;  // Display order in sidebar
  enabled: boolean 
};

export const TAB_REGISTRY: AppTab[] = [
  { id: 'home', title: 'Home', route: '/home', icon: 'home', order: 5, enabled: true },
  // Add your tab:
  { id: 'your_tab_id', title: 'Your Tab', route: '/your-route', icon: 'star', order: 10, enabled: true },
];
```

### Step 2: Create the page component in `src/pages/`

```typescript
// src/pages/YourTab.tsx
import React from 'react';
import { tokens } from '../theme/config';

interface YourTabProps {
  isVisible?: boolean;  // Required for lazy loading optimization
}

export const YourTab: React.FC<YourTabProps> = ({ isVisible }) => {
  // Fetch data when tab becomes visible
  React.useEffect(() => {
    if (!isVisible) return;
    // Load your data here
  }, [isVisible]);

  return (
    <div className="space-y-6">
      <div className={tokens.card.base}>
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">Your Content</h2>
        {/* Your content here */}
      </div>
    </div>
  );
};
```

### Step 3: Update `src/components/AppShell.tsx`

1. Import the component and icon:
```typescript
import { Star } from 'lucide-react';
import { YourTab } from '../pages/YourTab';
```

2. Add to `ModuleId` type in `Sidebar.tsx`:
```typescript
export type ModuleId = 'home' | 'your_tab_id' | /* ... */;
```

3. Add icon mapping in `AppShell.tsx`:
```typescript
const iconMap = {
  'star': <Star className={cn('w-5 h-5', tokens.icon?.default)} />,
  // ...
};
```

4. Add tab render section:
```typescript
{visitedTabs.has('your_tab_id') && (
  <section style={{ display: activeModule === 'your_tab_id' ? 'block' : 'none' }}>
    <YourTab isVisible={activeModule === 'your_tab_id'} />
  </section>
)}
```

---

## How To: Change the Color Scheme

Colors are centralized at the top of `src/theme/config.ts`. To change your app's color scheme, edit the `colors` object:

```typescript
const colors = {
  // Primary brand color (buttons, links, focus rings)
  primary: 'emerald',    // Try: 'blue', 'violet', 'rose', 'orange'
  
  // Accent color (secondary highlights)
  accent: 'teal',        // Try: 'cyan', 'indigo', 'pink'
  
  // Semantic colors
  success: 'emerald',
  warning: 'amber',
  danger: 'rose',
  
  // Neutral palette (backgrounds, borders, text)
  neutral: 'neutral',    // Try: 'slate', 'gray', 'zinc', 'stone'
};
```

All components use tokens derived from these colors, so changes propagate everywhere automatically.

---

## How To: Use Theme Tokens

All styling should use the centralized token system for consistency.

### Import tokens
```typescript
import { tokens, cn, palette, theme } from '../theme/config';
```

### Using palette for semantic colors
```typescript
// Text colors
<p className={palette.text}>Primary text</p>
<p className={palette.textMuted}>Muted text</p>
<p className={palette.primaryText}>Primary color text</p>

// Backgrounds
<div className={palette.bg}>Dark background</div>
<div className={palette.bgSurface}>Card surface</div>
<div className={palette.primaryBg}>Primary color background</div>

// Borders
<div className={cn('border', palette.border)}>Default border</div>
<div className={cn('border', palette.primaryBorder)}>Primary border</div>
```

### Using tokens for components

```typescript
// Card
<div className={tokens.card.base}>...</div>
<div className={tokens.card.highlighted}>Emphasized card</div>

// Buttons
<button className={cn(tokens.button.base, tokens.button.primary)}>Primary</button>
<button className={cn(tokens.button.base, tokens.button.secondary)}>Secondary</button>
<button className={cn(tokens.button.base, tokens.button.ghost)}>Ghost</button>
<button className={cn(tokens.button.base, tokens.button.danger)}>Danger</button>

// Icon buttons (toolbar style)
<button className={cn(tokens.iconButton.base, tokens.iconButton.default)}>
  <Icon className="w-5 h-5" />
</button>

// Inputs
<input className={cn(tokens.input.base, tokens.input.focus)} />

// Select
<div className={tokens.select.wrapper}>
  <select className={tokens.select.base}>...</select>
  <ChevronDown className={tokens.select.chevron} />
</div>

// Table
<div className={tokens.table.wrapper}>
  <table className={tokens.table.table}>
    <thead className={tokens.table.thead}>
      <tr><th className={tokens.table.th}>Header</th></tr>
    </thead>
    <tbody>
      <tr className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
        <td className={tokens.table.td}>Cell</td>
      </tr>
    </tbody>
  </table>
</div>

// Badge
<span className={cn(tokens.badge.base, tokens.badge.success)}>Active</span>

// Modal
<div className={tokens.modal.overlay}>
  <div className={tokens.modal.content}>...</div>
</div>

// Text styles
<h1 className={tokens.text.heading}>Heading</h1>
<p className={tokens.text.body}>Body text</p>
<p className={tokens.text.muted}>Muted text</p>
<label className={tokens.text.label}>Label</label>

// Links
<a className={tokens.link.primary}>Primary link</a>
```

### Available color tokens in `palette`
- **Backgrounds**: `bg`, `bgSurface`, `bgSurfaceAlt`, `bgHover`, `bgActive`
- **Borders**: `border`, `borderLight`, `borderPrimary`
- **Text**: `text`, `textMuted`, `textSubtle`, `textInverse`
- **Primary**: `primaryBg`, `primaryBgHover`, `primaryText`, `primaryTextHover`, `primaryBorder`
- **Accent**: `accentBg`, `accentText`, `accentBorder`, `accentBgSubtle`
- **Success**: `successBg`, `successBgSubtle`, `successText`, `successTextLight`, `successBorder`
- **Warning**: `warningBg`, `warningBgSubtle`, `warningText`, `warningTextLight`, `warningBorder`
- **Danger**: `dangerBg`, `dangerBgSubtle`, `dangerText`, `dangerTextLight`, `dangerBorder`
- **Focus**: `focusRing` (standard focus ring for all interactive elements)

---

## How To: Connect to Supabase

### 1. Environment setup (`.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Add data fetching to `src/lib/api.ts`

```typescript
// Pattern: fetch data
export const fetchYourData = async (): Promise<YourType[]> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase;
  const isSupabaseConfigured = Boolean((mod as any).isSupabaseConfigured);
  
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }
  
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data as YourType[];
};

// Pattern: save/update data
export const saveYourData = async (item: YourType): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase;
  
  const { error } = await supabase
    .from('your_table')
    .upsert(item, { onConflict: 'id' });
    
  if (error) throw error;
};

// Pattern: delete data
export const deleteYourData = async (id: string): Promise<void> => {
  const mod = await import('./supabase');
  const supabase = (mod as any).supabase;
  
  const { error } = await supabase
    .from('your_table')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
};
```

---

## Responsive Design (Desktop vs Mobile)

The template handles responsive layouts automatically:

### Breakpoint: `sm` (640px)
- **Desktop** (`sm:` prefix): Sidebar navigation, wider padding, larger typography
- **Mobile** (default): Hamburger menu, MobileDrawer, compact layout

### Key responsive patterns
```typescript
// Desktop sidebar, mobile drawer
<div className="hidden sm:flex">Desktop only</div>
<div className="sm:hidden">Mobile only</div>

// Responsive padding
<div className="p-4 sm:p-6">Content</div>

// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Responsive text
<h1 className="text-2xl sm:text-3xl">Title</h1>
```

### Mobile-first considerations
- Touch targets: minimum 44x44px (`min-h-[44px] min-w-[44px]`)
- Tap-friendly spacing between interactive elements
- Horizontal scroll prevention: use `max-w-full overflow-x-auto` on tables
- Stack columns on mobile, side-by-side on desktop

---

## Authentication

Auth uses Supabase Auth with a simple email/password flow.

### Protected routes
The `ProtectedRoute` component wraps authenticated content:

```typescript
// In App.tsx
<ProtectedRoute>
  <AppShell />
</ProtectedRoute>
```

### Auth context
```typescript
import { useAuth } from '../contexts/AuthContext';

const { isAuthenticated, login, logout, isLoading } = useAuth();
```

---

## Deployment

### Local Development
```bash
npm install
npm run dev
```

### Docker Build
```bash
# Build with environment variables
docker build -t my-app \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-key \
  .

# Run container
docker run -p 3000:8080 my-app
```

### Docker Compose
```bash
# Create .env file with your Supabase credentials
cp .env.example .env
# Edit .env with your values

# Build and run
docker-compose up --build -d
```

App runs on http://localhost:3000

---

## UI Scaffolds (Reference Patterns)

The `src/scaffolds/` folder contains reference implementations from a production app. These are **not active** - they're examples to copy and adapt.

### Available Patterns

| Pattern | File | Use For |
|---------|------|---------|
| Two-pane master/detail | `pages/PrioritiesTab.tsx` | Sidebar list + detail view |
| Card grid with filters | `pages/ChallengesTab.tsx` | Filterable card collections |
| Calendar tracker | `pages/HabitTrackerTab.tsx` | Daily/weekly tracking |
| Stats dashboard | `components/HabitStatsModule.tsx` | Metrics and stats display |
| Achievement badges | `components/ChallengesModule.tsx` | Gamification, progress badges |
| Editable table | `components/TodosTable.tsx` | Inline-editable CRUD table |
| Timer with history | `pages/TimeTrackingTab.tsx` | Time tracking interface |
| Multi-section page | `pages/GrowthTab.tsx` | Complex page with sections |

### Using Scaffolds
1. Copy the file to `src/pages/` or `src/components/`
2. Update imports to use current theme tokens
3. Replace API calls with your data fetching
4. Update types to match your data model

See `src/scaffolds/README.md` for detailed documentation on each pattern.

---

## File Checklist for New Projects

When creating a new app from this template:

- [ ] Update `src/theme/config.ts` → `product_name`
- [ ] Update `src/config/tabs.ts` → define your tabs
- [ ] Create pages in `src/pages/`
- [ ] Update `src/components/AppShell.tsx` → wire up pages
- [ ] Update `src/components/Sidebar.tsx` → add to `ModuleId` type
- [ ] Define types in `src/types/index.ts`
- [ ] Add API functions to `src/lib/api.ts`
- [ ] Create Supabase tables (save migrations in `migrations/`)
- [ ] Update `.env` with Supabase credentials
- [ ] Update `index.html` → title, meta tags
- [ ] Update `README.md` with project info

---

## Available Lucide Icons

Common icons already imported in AppShell: `Home`, `CheckSquare`, `Lightbulb`, `Target`, `Timer`, `Layers`, `Activity`, `Zap`, `Calendar`, `TrendingUp`, `LogOut`

Add more from https://lucide.dev/icons as needed.
