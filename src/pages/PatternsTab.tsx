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
  MoreVertical
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
