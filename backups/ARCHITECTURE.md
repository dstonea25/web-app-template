# Dashboard MVP - Architecture & Design Guide

## 🏗️ **CODE ARCHITECTURE & STRUCTURE**

### **File Organization**
```
src/
├── components/          # Shared UI components
│   ├── AppShell.tsx     # Main layout wrapper
│   ├── TopBanner.tsx    # Header with title/subtitle
│   ├── TabSwitcher.tsx  # Navigation between tabs
│   ├── TodosTable.tsx   # Presentational table component
│   └── SessionEditor.tsx # Modal for editing sessions
├── pages/               # Page-level components
│   ├── TodosTab.tsx     # Todos management page
│   └── TimeTrackingTab.tsx # Timer and sessions page
├── lib/                 # Utility modules
│   ├── api.ts          # Mocked API client
│   ├── storage.ts      # localStorage management
│   └── time.ts         # Timer utilities
├── theme/              # Design system
│   └── config.ts       # Theme tokens and utilities
└── types/              # TypeScript definitions
    └── index.ts        # Data models
```

### **Component Hierarchy**
```
App
└── AppShell
    ├── TopBanner (shared across all tabs)
    ├── TabSwitcher (navigation)
    └── Main Content
        ├── TodosTab
        │   └── TodosTable
        └── TimeTrackingTab
            └── SessionEditor (modal)
```

## 🎨 **VISUAL DESIGN SYSTEM**

### **Theme Configuration** (`/src/theme/config.ts`)
The design system is centralized with consistent tokens:

```typescript
// Color Palette
colors: {
  primary: 'slate-900',    // Dark text/buttons
  bg: 'white',            // Main background
  bgDark: 'slate-950',    // Dark mode background
}

// Design Tokens
radius: 'xl',             // Rounded corners (1rem)
spacing: 'tailwind_default', // Standard Tailwind spacing
fontStack: 'system-ui',   // System font stack
```

### **Pre-built Component Classes**
```typescript
themeClasses = {
  container: 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
  card: 'bg-white rounded-xl shadow-sm border border-gray-200',
  button: {
    primary: 'bg-slate-900 text-white px-4 py-2 rounded-xl hover:opacity-90',
    secondary: 'bg-gray-100 text-slate-900 px-4 py-2 rounded-xl hover:bg-gray-200'
  },
  input: 'border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-slate-900',
  table: {
    container: 'overflow-x-auto',
    base: 'min-w-full divide-y divide-gray-200',
    header: 'bg-gray-50',
    cell: 'px-6 py-4 whitespace-nowrap text-sm'
  }
}
```

### **Responsive Design**
- **Mobile-first approach** with Tailwind breakpoints
- **Touch targets ≥40px** for mobile accessibility
- **Horizontal table scrolling** on small screens
- **Centered max-width containers** on desktop

## 🧩 **COMPONENT BREAKDOWN**

### **1. AppShell** - Main Layout
- **Purpose**: Root layout component that orchestrates the entire app
- **Features**: 
  - Max-width container with responsive padding
  - Renders TopBanner and TabSwitcher consistently
  - Manages active tab state
  - Renders appropriate page content

### **2. TopBanner** - Header
- **Purpose**: Consistent header across all tabs
- **Features**:
  - App title and optional subtitle
  - Responsive typography (2xl on mobile, 3xl on desktop)
  - Uses theme tokens for consistent styling
  - Compact padding and typography

### **3. TabSwitcher** - Navigation
- **Purpose**: In-app navigation between features
- **Features**:
  - Two tabs: Todos (✓) and Time Tracking (⏱️)
  - Active state management
  - Responsive design (icons only on mobile, labels on desktop)
  - Accessible with ARIA attributes
  - Touch-friendly 40px minimum height

### **4. TodosTab** - Todo Management Page
- **Purpose**: Complete todo management interface
- **Features**:
  - Loads data from seed JSON or localStorage
  - Add new todos with form validation
  - In-memory state management
  - Stubbed "Save to API" functionality
  - Integrates with TodosTable component

### **5. TodosTable** - Presentational Table
- **Purpose**: Reusable table component for todos
- **Features**:
  - Filter by title/category
  - Sort by any column (title, priority, category, status)
  - Inline editing with click-to-edit
  - Priority badges with color coding
  - Status dropdown (active/completed)
  - Delete functionality
  - Empty state handling

### **6. TimeTrackingTab** - Timer & Sessions Page
- **Purpose**: Time tracking and session management
- **Features**:
  - Real-time count-up timer
  - Start/stop timer functionality
  - Session list with edit/delete
  - Note-taking for sessions
  - Duration calculation and formatting
  - Stubbed "Submit to API" functionality

### **7. SessionEditor** - Modal Editor
- **Purpose**: Edit session details in a modal
- **Features**:
  - Edit start/end times with datetime inputs
  - Edit session notes
  - Form validation
  - Confirm/cancel actions
  - Modal overlay with backdrop

## 🔧 **UTILITY MODULES**

### **API Client** (`/src/lib/api.ts`)
- **Mocked implementation** for MVP
- **300ms simulated delay** for realistic UX
- **Future webhook endpoints** stubbed
- **Exports**: `apiClient`, `postToBackend`

### **Storage Manager** (`/src/lib/storage.ts`)
- **localStorage persistence** for dev convenience
- **In-memory as source of truth**
- **Error handling** with fallbacks
- **Exports**: `getTodos`, `setTodos`, `getSessions`, `setSessions`

### **Time Utilities** (`/src/lib/time.ts`)
- **ISO date formatting**: `nowIso()`
- **Duration formatting**: `msToHms()` (HH:MM:SS)
- **Duration calculation**: `computeDurationMs()`
- **Date display**: `formatDateTime()`
- **Input formatting**: `formatDateTimeLocal()`, `parseDateTimeLocal()`

## 📱 **RESPONSIVE BEHAVIOR**

### **Mobile (< 640px)**
- Tab switcher shows icons only
- Tables scroll horizontally
- Form inputs stack vertically
- Touch targets ≥40px

### **Desktop (≥ 640px)**
- Tab switcher shows icons + labels
- Tables display fully
- Forms use grid layouts
- Hover states enabled

## 🎯 **KEY DESIGN PRINCIPLES**

1. **Local-First**: All data stored in-memory + optional localStorage
2. **Theme Consistency**: No hardcoded colors/fonts, all via theme tokens
3. **Component Isolation**: Each component owns its logic and state
4. **Accessibility**: Semantic HTML, keyboard navigation, ARIA attributes
5. **Extensibility**: Easy to add new tabs or features without breaking existing code

## 📊 **DATA MODELS**

### **Todo Interface**
```typescript
interface Todo {
  id?: string;
  title: string;
  priority?: string;
  category?: string;
  status?: 'active' | 'completed';
}
```

### **Session Interface**
```typescript
interface Session {
  id?: string;
  started_at: string; // ISO-8601
  ended_at?: string; // ISO-8601 (optional until stopped)
  duration_ms?: number; // computed on stop or edit
  note?: string;
}
```

## 🚀 **BUILD & DEPLOYMENT**

### **Development**
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run preview # Preview production build
```

### **Build Output**
- **JavaScript**: 203.03 kB (gzipped: 63.04 kB)
- **CSS**: 5.43 kB (gzipped: 1.41 kB)
- **HTML**: 0.46 kB (gzipped: 0.30 kB)

## 🔄 **STATE MANAGEMENT**

### **Local State**
- Each page component manages its own state
- React hooks (`useState`, `useEffect`) for state management
- No global state management library (Redux, Zustand, etc.)

### **Persistence Strategy**
1. **In-memory React state** for live UX
2. **Optional localStorage mirror** for dev convenience
3. **No file writes** in MVP
4. **Future webhook integration** stubbed

## 🧪 **TESTING & QUALITY**

### **TypeScript**
- Full type safety with strict mode
- Type-only imports for better tree-shaking
- Interface definitions for all data models

### **Linting**
- ESLint configuration for code quality
- No linting errors in current implementation

### **Accessibility**
- Semantic HTML elements
- ARIA attributes where appropriate
- Keyboard navigation support
- Focus management

## 📈 **PERFORMANCE**

### **Bundle Size**
- Optimized with Vite's tree-shaking
- No external component libraries
- Minimal dependencies

### **Runtime Performance**
- Local-first architecture for instant updates
- Efficient re-renders with React hooks
- No unnecessary API calls in MVP

## 🔮 **FUTURE EXTENSIONS**

### **Adding New Tabs**
1. Create new page component in `/src/pages/`
2. Add tab definition to `TabSwitcher`
3. Update `AppShell` to render new tab
4. Follow existing patterns for state management

### **Real API Integration**
1. Replace mocked `ApiClient` with real implementation
2. Update webhook endpoints in configuration
3. Add authentication headers
4. Implement error handling and retry logic

### **Enhanced Features**
- Dark mode toggle
- Data export/import
- Advanced filtering and search
- Keyboard shortcuts
- Offline support with service workers

---

*This architecture document provides a comprehensive overview of the Dashboard MVP implementation. The codebase follows React best practices with a focus on maintainability, accessibility, and user experience.*
