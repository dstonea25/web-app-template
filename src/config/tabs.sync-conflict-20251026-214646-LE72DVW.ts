export type AppTab = { 
  id: 'home' | 'todos' | 'ideas' | 'priorities' | 'time' | 'allocations' | 'habit_tracker'; 
  title: string; 
  route: string; 
  icon: string; 
  order: number; 
  enabled: boolean 
};

export const TAB_REGISTRY: AppTab[] = [
  { id: 'home', title: 'Home', route: '/home', icon: 'home', order: 5, enabled: true },
  { id: 'todos', title: 'To-Dos', route: '/todos', icon: 'check-square', order: 10, enabled: true },
  { id: 'ideas', title: 'Ideas', route: '/ideas', icon: 'lightbulb', order: 15, enabled: true },
  { id: 'priorities', title: 'Priorities', route: '/priorities', icon: 'target', order: 18, enabled: true },
  { id: 'time', title: 'Time Tracking', route: '/time', icon: 'timer', order: 20, enabled: true },
  { id: 'allocations', title: 'Allocations', route: '/allocations', icon: 'layers', order: 25, enabled: true },
  { id: 'habit_tracker', title: 'Habit Tracker', route: '/habits', icon: 'activity', order: 30, enabled: true }
];
