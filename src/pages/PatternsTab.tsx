/**
 * Patterns Gallery Tab
 * 
 * Live, interactive demos of UI patterns from scaffolds.
 * Point to these when describing what you want to an agent:
 * "Use the 2-pane master/detail pattern but for [your use case]"
 */

import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Star, 
  Trophy,
  Lock,
  CheckCircle,
  Circle,
  Target,
  Flame,
  BarChart3,
  TrendingUp,
  Clock,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  X,
  Save
} from 'lucide-react';
import { tokens, cn, palette, theme } from '../theme/config';
import { toast } from '../lib/notifications/toast';

interface PatternsTabProps {
  isVisible?: boolean;
}

// =============================================================================
// PATTERN 1: Two-Pane Master/Detail (like PrioritiesTab)
// =============================================================================
const TwoPanePattern: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>('quest-2');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['main', 'side']));
  
  const mockData = {
    groups: [
      {
        id: 'main',
        name: 'Main Quests',
        items: [
          { id: 'quest-1', name: 'Defeat the Dragon', status: 'completed', progress: 100 },
          { id: 'quest-2', name: 'Find the Ancient Artifact', status: 'active', progress: 60 },
          { id: 'quest-3', name: 'Rescue the Princess', status: 'locked', progress: 0 },
        ]
      },
      {
        id: 'side',
        name: 'Side Quests', 
        items: [
          { id: 'quest-4', name: 'Collect 10 Herbs', status: 'active', progress: 30 },
          { id: 'quest-5', name: 'Deliver the Letter', status: 'pending', progress: 0 },
        ]
      }
    ]
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItem = mockData.groups
    .flatMap(g => g.items)
    .find(i => i.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[400px]">
      {/* Left Pane: List */}
      <div className={cn(tokens.card.base, 'overflow-y-auto')}>
        <h4 className={cn('font-semibold mb-3', palette.text)}>Quest Log</h4>
        {mockData.groups.map(group => (
          <div key={group.id} className="mb-2">
            <button
              onClick={() => toggleGroup(group.id)}
              className={cn('flex items-center gap-2 w-full px-2 py-1.5 rounded-lg', palette.bgHover)}
            >
              {expandedGroups.has(group.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className={cn('text-sm font-medium', palette.text)}>{group.name}</span>
              <span className={cn('ml-auto text-xs', palette.textMuted)}>{group.items.length}</span>
            </button>
            
            {expandedGroups.has(group.id) && (
              <div className="ml-4 mt-1 space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-sm',
                      selectedId === item.id ? palette.bgActive : palette.bgHover,
                      palette.text
                    )}
                  >
                    {item.status === 'completed' ? (
                      <CheckCircle className={cn('w-4 h-4', palette.successText)} />
                    ) : item.status === 'locked' ? (
                      <Lock className={cn('w-4 h-4', palette.textMuted)} />
                    ) : (
                      <Circle className={cn('w-4 h-4', palette.primaryText)} />
                    )}
                    <span className={item.status === 'locked' ? palette.textMuted : ''}>{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right Pane: Detail */}
      <div className={cn(tokens.card.base)}>
        {selectedItem ? (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className={cn('text-lg font-semibold', palette.text)}>{selectedItem.name}</h3>
                <span className={cn(
                  tokens.badge.base,
                  selectedItem.status === 'completed' ? tokens.badge.success :
                  selectedItem.status === 'active' ? tokens.badge.warning :
                  tokens.badge.neutral
                )}>
                  {selectedItem.status}
                </span>
              </div>
              <button className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className={cn('text-sm mb-1', palette.textMuted)}>Progress</div>
              <div className={cn('h-2 rounded-full', palette.bgSurfaceAlt)}>
                <div 
                  className={cn('h-full rounded-full', palette.primaryBg)}
                  style={{ width: `${selectedItem.progress}%` }}
                />
              </div>
              <div className={cn('text-sm mt-1', palette.textMuted)}>{selectedItem.progress}% complete</div>
            </div>

            <div className={cn('text-sm', palette.textMuted)}>
              <p>Quest details would go here. Objectives, rewards, related NPCs, etc.</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button className={cn(tokens.button.base, tokens.button.primary)}>
                Track Quest
              </button>
              <button className={cn(tokens.button.base, tokens.button.secondary)}>
                Abandon
              </button>
            </div>
          </div>
        ) : (
          <div className={cn('text-center py-8', palette.textMuted)}>
            Select a quest to view details
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// PATTERN 2: Badge/Achievement Cards (like ChallengesModule)
// =============================================================================
const BadgeGridPattern: React.FC = () => {
  const badges = [
    { id: '1', name: 'First Steps', desc: 'Complete your first quest', icon: Star, progress: 100, unlocked: true },
    { id: '2', name: 'Dragon Slayer', desc: 'Defeat 5 dragons', icon: Trophy, progress: 60, unlocked: false, current: 3, target: 5 },
    { id: '3', name: 'Explorer', desc: 'Visit all regions', icon: Target, progress: 40, unlocked: false, current: 4, target: 10 },
    { id: '4', name: 'On Fire', desc: '7-day streak', icon: Flame, progress: 85, unlocked: false, current: 6, target: 7 },
    { id: '5', name: 'Collector', desc: 'Gather 100 items', icon: Star, progress: 0, unlocked: false, locked: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {badges.map(badge => {
        const Icon = badge.icon;
        return (
          <div 
            key={badge.id}
            className={cn(
              tokens.card.base,
              badge.locked ? 'opacity-50' : '',
              badge.unlocked ? `border-${theme.colors.success}-500/50` : ''
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                badge.unlocked ? palette.successBgSubtle : palette.bgSurfaceAlt
              )}>
                {badge.locked ? (
                  <Lock className={cn('w-6 h-6', palette.textMuted)} />
                ) : (
                  <Icon className={cn('w-6 h-6', badge.unlocked ? palette.successText : palette.primaryText)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={cn('font-medium', palette.text)}>{badge.name}</h4>
                <p className={cn('text-sm', palette.textMuted)}>{badge.desc}</p>
              </div>
              {badge.unlocked && (
                <CheckCircle className={cn('w-5 h-5', palette.successText)} />
              )}
            </div>
            
            {!badge.locked && !badge.unlocked && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className={palette.textMuted}>Progress</span>
                  <span className={palette.text}>{badge.current}/{badge.target}</span>
                </div>
                <div className={cn('h-1.5 rounded-full', palette.bgSurfaceAlt)}>
                  <div 
                    className={cn('h-full rounded-full', palette.primaryBg)}
                    style={{ width: `${badge.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// PATTERN 3: Stats Dashboard (like HabitStatsModule)
// =============================================================================
const StatsDashboardPattern: React.FC = () => {
  const stats = [
    { label: 'Current Streak', value: '12', unit: 'days', icon: Flame, trend: '+3', positive: true },
    { label: 'Total Completed', value: '247', unit: 'tasks', icon: CheckCircle, trend: '+18', positive: true },
    { label: 'Avg. Per Day', value: '4.2', unit: 'tasks', icon: BarChart3, trend: '-0.5', positive: false },
    { label: 'Time Tracked', value: '32h', unit: 'this week', icon: Clock, trend: '+5h', positive: true },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className={tokens.card.base}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-4 h-4', palette.primaryText)} />
              <span className={cn('text-sm', palette.textMuted)}>{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-bold', palette.text)}>{stat.value}</span>
              <span className={cn('text-sm', palette.textMuted)}>{stat.unit}</span>
            </div>
            <div className={cn(
              'text-xs mt-1 flex items-center gap-1',
              stat.positive ? palette.successText : palette.dangerText
            )}>
              <TrendingUp className={cn('w-3 h-3', !stat.positive && 'rotate-180')} />
              {stat.trend}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// PATTERN 4: Calendar/Tracker Grid (like HabitTrackerTab)
// =============================================================================
const TrackerGridPattern: React.FC = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [checked, setChecked] = useState<Set<string>>(new Set(['0-0', '0-1', '0-2', '0-4', '1-0', '1-1', '1-3', '2-2']));
  
  const habits = [
    { id: '0', name: 'Exercise', goal: 5 },
    { id: '1', name: 'Read', goal: 7 },
    { id: '2', name: 'Meditate', goal: 4 },
  ];

  const toggleDay = (habitId: string, dayIndex: number) => {
    const key = `${habitId}-${dayIndex}`;
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    toast.success('Updated!');
  };

  return (
    <div className={tokens.table.wrapper}>
      <table className={tokens.table.table}>
        <thead className={tokens.table.thead}>
          <tr>
            <th className={tokens.table.th}>Habit</th>
            {days.map(day => (
              <th key={day} className={cn(tokens.table.th, 'text-center w-12')}>{day}</th>
            ))}
            <th className={cn(tokens.table.th, 'text-center')}>Done</th>
          </tr>
        </thead>
        <tbody>
          {habits.map(habit => {
            const completed = days.filter((_, i) => checked.has(`${habit.id}-${i}`)).length;
            return (
              <tr key={habit.id} className={tokens.table.tr_zebra}>
                <td className={tokens.table.td}>{habit.name}</td>
                {days.map((_, i) => {
                  const isChecked = checked.has(`${habit.id}-${i}`);
                  return (
                    <td key={i} className={cn(tokens.table.td, 'text-center')}>
                      <button
                        onClick={() => toggleDay(habit.id, i)}
                        className={cn(
                          'w-8 h-8 rounded-lg border transition-colors',
                          isChecked 
                            ? cn(palette.primaryBg, palette.primaryBorder, 'text-white')
                            : cn(palette.bgSurfaceAlt, palette.border, palette.bgHover)
                        )}
                      >
                        {isChecked && <CheckCircle className="w-4 h-4 mx-auto" />}
                      </button>
                    </td>
                  );
                })}
                <td className={cn(tokens.table.td, 'text-center')}>
                  <span className={cn(
                    'font-medium',
                    completed >= habit.goal ? palette.successText : palette.text
                  )}>
                    {completed}/{habit.goal}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// PATTERN 5: Editable Card List (like CommittedPrioritiesModule)
// =============================================================================
const EditableCardListPattern: React.FC = () => {
  const [items, setItems] = useState([
    { id: '1', name: 'Launch MVP', status: 'in_progress', children: [
      { id: '1a', name: 'Finalize design', done: true },
      { id: '1b', name: 'Build backend', done: true },
      { id: '1c', name: 'Deploy to production', done: false },
    ]},
    { id: '2', name: 'User Research', status: 'pending', children: [
      { id: '2a', name: 'Schedule interviews', done: false },
      { id: '2b', name: 'Analyze feedback', done: false },
    ]},
  ]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']));

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChild = (parentId: string, childId: string) => {
    setItems(prev => prev.map(item => 
      item.id === parentId 
        ? { ...item, children: item.children.map(c => c.id === childId ? { ...c, done: !c.done } : c) }
        : item
    ));
    toast.success('Updated!');
  };

  return (
    <div className="space-y-3">
      {items.map(item => {
        const doneCount = item.children.filter(c => c.done).length;
        const progress = Math.round((doneCount / item.children.length) * 100);
        
        return (
          <div key={item.id} className={tokens.card.base}>
            <button
              onClick={() => toggleExpand(item.id)}
              className="flex items-center gap-3 w-full text-left"
            >
              {expanded.has(item.id) ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              <div className="flex-1">
                <div className={cn('font-medium', palette.text)}>{item.name}</div>
                <div className={cn('text-sm', palette.textMuted)}>
                  {doneCount}/{item.children.length} tasks · {progress}%
                </div>
              </div>
              <div className={cn('w-20 h-1.5 rounded-full', palette.bgSurfaceAlt)}>
                <div 
                  className={cn('h-full rounded-full', progress === 100 ? palette.successBg : palette.primaryBg)}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </button>
            
            {expanded.has(item.id) && (
              <div className="mt-3 ml-8 space-y-2">
                {item.children.map(child => (
                  <label key={child.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={child.done}
                      onChange={() => toggleChild(item.id, child.id)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                      child.done 
                        ? cn(palette.primaryBg, palette.primaryBorder) 
                        : cn(palette.bgSurfaceAlt, palette.border)
                    )}>
                      {child.done && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className={cn(
                      'text-sm',
                      child.done ? cn(palette.textMuted, 'line-through') : palette.text
                    )}>
                      {child.name}
                    </span>
                  </label>
                ))}
                <button className={cn('flex items-center gap-1 text-sm mt-2', palette.primaryText)}>
                  <Plus className="w-4 h-4" />
                  Add task
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// PATTERN 6: Month/Year Heatmap Overview (like MonthlyHabitOverview)
// =============================================================================
const MonthHeatmapPattern: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState({ year: 2026, month: 0 }); // January 2026
  
  // Generate mock activity data (days with activity intensity 0-4)
  const activityData: Record<string, number> = {
    '2026-01-02': 3, '2026-01-03': 2, '2026-01-05': 4, '2026-01-06': 1,
    '2026-01-08': 2, '2026-01-09': 4, '2026-01-10': 3, '2026-01-12': 2,
    '2026-01-13': 1, '2026-01-15': 4, '2026-01-16': 3, '2026-01-17': 2,
    '2026-01-19': 3, '2026-01-20': 4, '2026-01-22': 1, '2026-01-23': 2,
    '2026-01-24': 3, '2026-01-26': 4, '2026-01-27': 2, '2026-01-28': 3,
  };

  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedMonth.year, selectedMonth.month, 1).getDay();
  
  const monthName = new Date(selectedMonth.year, selectedMonth.month).toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const prevMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };
  
  const nextMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const getIntensityClass = (level: number) => {
    switch(level) {
      case 1: return 'bg-emerald-900/40';
      case 2: return 'bg-emerald-700/60';
      case 3: return 'bg-emerald-500/80';
      case 4: return 'bg-emerald-400';
      default: return palette.bgSurfaceAlt;
    }
  };

  // Build calendar grid
  const cells = [];
  // Empty cells for days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`empty-${i}`} className="h-8" />);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const intensity = activityData[dateStr] || 0;
    cells.push(
      <div
        key={day}
        className={cn(
          'h-8 rounded-md flex items-center justify-center text-xs cursor-pointer transition-colors',
          getIntensityClass(intensity),
          intensity > 0 ? 'text-white' : palette.textMuted
        )}
        title={`${dateStr}: ${intensity} activities`}
      >
        {day}
      </div>
    );
  }

  const totalActivities = Object.values(activityData).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(activityData).length;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className={cn('font-semibold', palette.text)}>{monthName}</h3>
        <button onClick={nextMonth} className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className={cn('text-xs text-center', palette.textMuted)}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells}
        </div>
      </div>

      {/* Legend + Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={cn('text-xs', palette.textMuted)}>Less</span>
          {[0, 1, 2, 3, 4].map(level => (
            <div key={level} className={cn('w-4 h-4 rounded', getIntensityClass(level))} />
          ))}
          <span className={cn('text-xs', palette.textMuted)}>More</span>
        </div>
        <div className={cn('text-sm', palette.textMuted)}>
          {activeDays} active days · {totalActivities} total
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// PATTERN 7: Calendar Grid + Sidebar Form (like CalendarTab)
// =============================================================================
const CalendarSidebarPattern: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-01-15');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({
    theme: 'Sprint Planning',
    focusAreas: ['Product launch', 'Team sync', 'Documentation'],
    notes: ''
  });

  const currentMonth = { year: 2026, month: 0 };
  const daysInMonth = 31;
  const firstDayOfWeek = 3; // Wednesday

  // Mock events
  const events: Record<string, { title: string; color: string }[]> = {
    '2026-01-02': [{ title: 'Team Standup', color: 'bg-blue-500' }],
    '2026-01-05': [{ title: 'Sprint Review', color: 'bg-emerald-500' }],
    '2026-01-08': [{ title: 'Planning', color: 'bg-amber-500' }],
    '2026-01-10': [{ title: 'Demo Day', color: 'bg-purple-500' }],
    '2026-01-15': [{ title: 'Retro', color: 'bg-emerald-500' }, { title: '1:1 Meeting', color: 'bg-blue-500' }],
    '2026-01-20': [{ title: 'Launch!', color: 'bg-rose-500' }],
    '2026-01-22': [{ title: 'Review', color: 'bg-amber-500' }],
  };

  // Build calendar
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`e-${i}`} className={cn('min-h-[80px] border rounded-lg', palette.border, 'opacity-30')} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events[dateStr] || [];
    const isSelected = dateStr === selectedDate;
    const isWeekend = (firstDayOfWeek + day - 1) % 7 === 0 || (firstDayOfWeek + day - 1) % 7 === 6;
    
    cells.push(
      <div
        key={day}
        onClick={() => { setSelectedDate(dateStr); setSidebarOpen(true); }}
        className={cn(
          'min-h-[80px] border rounded-lg p-1.5 cursor-pointer transition-colors',
          isSelected ? palette.primaryBorder : palette.border,
          isSelected ? 'bg-emerald-500/10' : palette.bgHover,
          isWeekend && !isSelected ? 'opacity-60' : ''
        )}
      >
        <div className={cn('text-sm font-medium mb-1', isSelected ? palette.primaryText : palette.text)}>
          {day}
        </div>
        <div className="space-y-0.5">
          {dayEvents.slice(0, 2).map((ev, i) => (
            <div key={i} className={cn('text-xs px-1 py-0.5 rounded truncate text-white', ev.color)}>
              {ev.title}
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className={cn('text-xs', palette.textMuted)}>+{dayEvents.length - 2} more</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      {/* Calendar Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn('font-semibold', palette.text)}>January 2026</h3>
          <div className="flex gap-2">
            <button className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className={cn('text-xs text-center py-1', palette.textMuted)}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells}
        </div>
      </div>

      {/* Sidebar Form */}
      {sidebarOpen && selectedDate && (
        <div className={cn(tokens.card.base, 'h-fit')}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={cn('font-semibold', palette.text)}>
              {new Date(selectedDate).toLocaleDateString('default', { month: 'long', day: 'numeric' })}
            </h4>
            <button 
              onClick={() => setSidebarOpen(false)}
              className={cn(tokens.button.base, tokens.button.ghost, 'px-2')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={cn('block mb-1', tokens.text.label)}>Theme</label>
              <input
                type="text"
                value={formData.theme}
                onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                className={cn(tokens.input.base, tokens.input.focus)}
              />
            </div>

            <div>
              <label className={cn('block mb-1', tokens.text.label)}>Focus Areas</label>
              <div className="space-y-2">
                {formData.focusAreas.map((area, i) => (
                  <div key={i} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', palette.bgSurfaceAlt)}>
                    <span className={cn('flex-1 text-sm', palette.text)}>{area}</span>
                    <button className={cn('text-xs', palette.textMuted, palette.dangerText)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button className={cn('flex items-center gap-1 text-sm', palette.primaryText)}>
                  <Plus className="w-4 h-4" /> Add focus area
                </button>
              </div>
            </div>

            <div>
              <label className={cn('block mb-1', tokens.text.label)}>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes for this day..."
                rows={3}
                className={cn(tokens.input.base, tokens.input.focus)}
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { toast.success('Saved!'); setSidebarOpen(false); }}
                className={cn(tokens.button.base, tokens.button.primary, 'flex-1')}
              >
                <Save className="w-4 h-4 mr-2" /> Save
              </button>
              <button 
                onClick={() => setSidebarOpen(false)}
                className={cn(tokens.button.base, tokens.button.secondary)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PATTERN 8: Editable Data Table (like TodosTable)
// =============================================================================
const EditableTablePattern: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [items, setItems] = useState([
    { id: '1', name: 'Implement user auth', priority: 'high', status: 'in_progress', dueDate: '2026-01-15' },
    { id: '2', name: 'Design dashboard', priority: 'medium', status: 'done', dueDate: '2026-01-10' },
    { id: '3', name: 'Write documentation', priority: 'low', status: 'todo', dueDate: '2026-01-20' },
    { id: '4', name: 'Setup CI/CD', priority: 'high', status: 'todo', dueDate: '2026-01-18' },
  ]);

  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['todo', 'in_progress', 'done'];

  const handleUpdate = (id: string, field: string, value: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleCommit = () => {
    setEditingId(null);
    setEditingField(null);
    toast.success('Saved!');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: string) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingField(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      // Move to next field/row
      const fields = ['name', 'priority', 'status', 'dueDate'];
      const fieldIdx = fields.indexOf(field);
      if (fieldIdx < fields.length - 1) {
        setEditingId(id);
        setEditingField(fields[fieldIdx + 1]);
      } else {
        const itemIdx = items.findIndex(i => i.id === id);
        if (itemIdx < items.length - 1) {
          setEditingId(items[itemIdx + 1].id);
          setEditingField('name');
        }
      }
    }
  };

  const startEdit = (id: string, field: string) => {
    setEditingId(id);
    setEditingField(field);
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      critical: tokens.badge.danger,
      high: tokens.badge.warning,
      medium: tokens.badge.neutral,
      low: tokens.badge.success,
    };
    return styles[priority] || tokens.badge.neutral;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      done: tokens.badge.success,
      in_progress: tokens.badge.warning,
      todo: tokens.badge.neutral,
    };
    return styles[status] || tokens.badge.neutral;
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Deleted!');
  };

  return (
    <div className="space-y-3">
      <div className={tokens.table.wrapper}>
        <table className={tokens.table.table}>
          <thead className={tokens.table.thead}>
            <tr>
              <th className={tokens.table.th}>Task (click to edit)</th>
              <th className={cn(tokens.table.th, 'w-28')}>Priority</th>
              <th className={cn(tokens.table.th, 'w-28')}>Status</th>
              <th className={cn(tokens.table.th, 'w-32')}>Due Date</th>
              <th className={cn(tokens.table.th, 'w-20')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={cn(tokens.table.tr_zebra, tokens.table.row_hover)}>
                {/* Name - text input */}
                <td className={tokens.table.td}>
                  {editingId === item.id && editingField === 'name' ? (
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdate(item.id, 'name', e.target.value)}
                      onBlur={handleCommit}
                      onKeyDown={(e) => handleKeyDown(e, item.id, 'name')}
                      className={cn(tokens.input.base, tokens.input.focus, 'py-1')}
                      autoFocus
                    />
                  ) : (
                    <span 
                      onClick={() => startEdit(item.id, 'name')}
                      className={cn('cursor-pointer', palette.primaryTextHover)}
                    >
                      {item.name}
                    </span>
                  )}
                </td>

                {/* Priority - select */}
                <td className={tokens.table.td}>
                  {editingId === item.id && editingField === 'priority' ? (
                    <select
                      value={item.priority}
                      onChange={(e) => { handleUpdate(item.id, 'priority', e.target.value); handleCommit(); }}
                      onBlur={handleCommit}
                      className={cn(tokens.input.base, tokens.input.focus, 'py-1')}
                      autoFocus
                    >
                      {priorities.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <span 
                      onClick={() => startEdit(item.id, 'priority')}
                      className={cn(tokens.badge.base, getPriorityBadge(item.priority), 'cursor-pointer')}
                    >
                      {item.priority}
                    </span>
                  )}
                </td>

                {/* Status - select */}
                <td className={tokens.table.td}>
                  {editingId === item.id && editingField === 'status' ? (
                    <select
                      value={item.status}
                      onChange={(e) => { handleUpdate(item.id, 'status', e.target.value); handleCommit(); }}
                      onBlur={handleCommit}
                      className={cn(tokens.input.base, tokens.input.focus, 'py-1')}
                      autoFocus
                    >
                      {statuses.map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <span 
                      onClick={() => startEdit(item.id, 'status')}
                      className={cn(tokens.badge.base, getStatusBadge(item.status), 'cursor-pointer')}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  )}
                </td>

                {/* Due Date - date input */}
                <td className={tokens.table.td}>
                  {editingId === item.id && editingField === 'dueDate' ? (
                    <input
                      type="date"
                      value={item.dueDate}
                      onChange={(e) => handleUpdate(item.id, 'dueDate', e.target.value)}
                      onBlur={handleCommit}
                      onKeyDown={(e) => handleKeyDown(e, item.id, 'dueDate')}
                      className={cn(tokens.input.date, tokens.input.focus, 'py-1')}
                      autoFocus
                    />
                  ) : (
                    <span 
                      onClick={() => startEdit(item.id, 'dueDate')}
                      className={cn('cursor-pointer', palette.primaryTextHover)}
                    >
                      {item.dueDate}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className={tokens.table.td}>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => startEdit(item.id, 'name')}
                      className={cn(tokens.iconButton.base, tokens.iconButton.default)}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className={cn(tokens.iconButton.base, tokens.iconButton.danger)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <button className={cn(tokens.button.base, tokens.button.secondary)}>
        <Plus className="w-4 h-4 mr-2" /> Add Task
      </button>
    </div>
  );
};

// =============================================================================
// MAIN PATTERNS TAB
// =============================================================================
export const PatternsTab: React.FC<PatternsTabProps> = ({ isVisible }) => {
  const [expandedPattern, setExpandedPattern] = useState<string | null>('two-pane');
  
  if (!isVisible) return null;

  const patterns = [
    { 
      id: 'two-pane', 
      name: '2-Pane Master/Detail', 
      desc: 'Expandable sidebar list + detail panel. Good for: quest logs, project management, settings.',
      scaffold: 'PrioritiesTab.tsx',
      component: TwoPanePattern 
    },
    { 
      id: 'badge-grid', 
      name: 'Badge/Achievement Cards', 
      desc: 'Card grid with progress indicators and locked states. Good for: achievements, challenges, milestones.',
      scaffold: 'ChallengesModule.tsx',
      component: BadgeGridPattern 
    },
    { 
      id: 'stats', 
      name: 'Stats Dashboard', 
      desc: 'Stat cards with values, trends, and icons. Good for: analytics, metrics, KPIs.',
      scaffold: 'HabitStatsModule.tsx',
      component: StatsDashboardPattern 
    },
    { 
      id: 'tracker', 
      name: 'Calendar Tracker Grid', 
      desc: 'Weekly/daily checkbox grid. Good for: habit tracking, attendance, schedules.',
      scaffold: 'HabitTrackerTab.tsx',
      component: TrackerGridPattern 
    },
    { 
      id: 'nested-list', 
      name: 'Expandable Nested List', 
      desc: 'Collapsible groups with checkable children. Good for: OKRs, project tasks, nested todos.',
      scaffold: 'CommittedPrioritiesModule.tsx',
      component: EditableCardListPattern 
    },
    { 
      id: 'month-heatmap', 
      name: 'Month/Year Heatmap', 
      desc: 'Calendar heatmap showing activity intensity over time. Good for: usage tracking, streaks, contribution graphs.',
      scaffold: 'MonthlyHabitOverview.tsx',
      component: MonthHeatmapPattern 
    },
    { 
      id: 'calendar-sidebar', 
      name: 'Calendar + Sidebar Form', 
      desc: 'Month grid with clickable days and a detail sidebar for editing. Good for: scheduling, planning, event management.',
      scaffold: 'CalendarTab.tsx (scaffold not included)',
      component: CalendarSidebarPattern 
    },
    { 
      id: 'editable-table', 
      name: 'Editable Data Table', 
      desc: 'Table with inline editing (click to edit, Tab navigation, Enter/Escape). Good for: task lists, data management, CRUD.',
      scaffold: 'TodosTable.tsx',
      component: EditableTablePattern 
    },
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      <div className={cn(tokens.card.base, palette.accentBorder, palette.accentBgSubtle)}>
        <p className={cn('text-sm', palette.text)}>
          <strong>How to use:</strong> Point to these patterns when describing features to an agent. 
          Example: <em>"Use the 2-Pane Master/Detail pattern but for a quest log where..."</em>
        </p>
        <p className={cn('text-sm mt-2', palette.textMuted)}>
          Each pattern maps to a scaffold file in <code className={palette.accentText}>src/scaffolds/</code>
        </p>
      </div>

      {patterns.map(pattern => {
        const isExpanded = expandedPattern === pattern.id;
        const Component = pattern.component;
        
        return (
          <div key={pattern.id} className={tokens.card.base}>
            <button
              onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
              className="flex items-center gap-3 w-full text-left"
            >
              {isExpanded ? (
                <ChevronDown className={cn('w-5 h-5', palette.text)} />
              ) : (
                <ChevronRight className={cn('w-5 h-5', palette.text)} />
              )}
              <div className="flex-1">
                <div className={cn('font-semibold', palette.text)}>{pattern.name}</div>
                <div className={cn('text-sm', palette.textMuted)}>{pattern.desc}</div>
              </div>
              <code className={cn('text-xs px-2 py-1 rounded', palette.bgSurfaceAlt, palette.textMuted)}>
                {pattern.scaffold}
              </code>
            </button>
            
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <Component />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
