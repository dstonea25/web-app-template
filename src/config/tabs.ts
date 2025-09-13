export type AppTab = { 
  id: 'todos' | 'ideas' | 'time'; 
  title: string; 
  route: string; 
  icon: string; 
  order: number; 
  enabled: boolean 
};

export const TAB_REGISTRY: AppTab[] = [
  { id: 'todos', title: 'To-Dos', route: '/todos', icon: 'check-square', order: 10, enabled: true },
  { id: 'ideas', title: 'Ideas', route: '/ideas', icon: 'lightbulb', order: 15, enabled: true },
  { id: 'time', title: 'Time Tracking', route: '/time', icon: 'timer', order: 20, enabled: true }
];
