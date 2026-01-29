/**
 * Tab Registry
 * 
 * This is THE source of truth for navigation tabs.
 * Add, remove, or modify tabs here.
 * 
 * Instructions:
 * 1. Add your tab ID to the AppTab type union
 * 2. Add your tab configuration to TAB_REGISTRY
 * 3. Create the corresponding page component in src/pages/
 * 4. Wire it up in AppShell.tsx
 */

export type AppTab = { 
  id: 'home' | 'showcase';  // Add your tab IDs here
  title: string; 
  route: string; 
  icon: string;   // Lucide icon name (lowercase): home, star, settings, etc.
  order: number;  // Display order in sidebar (lower = higher)
  enabled: boolean 
};

export const TAB_REGISTRY: AppTab[] = [
  { 
    id: 'home', 
    title: 'Home', 
    route: '/home', 
    icon: 'home', 
    order: 5, 
    enabled: true 
  },
  { 
    id: 'showcase', 
    title: 'Components', 
    route: '/components', 
    icon: 'layout-grid', 
    order: 10, 
    enabled: true 
  },
  // Add more tabs here:
  // { id: 'your_tab', title: 'Your Tab', route: '/your-route', icon: 'star', order: 15, enabled: true },
];
