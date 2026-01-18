import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import type { CalendarEvent, CalendarEventInput, Habit, HabitYearlyStats } from '../types';
import { tokens, cn } from '../theme/config';
import { apiClient } from '../lib/api';
import toast from '../lib/notifications/toast';
import { X } from 'lucide-react';
import { ChallengesModule } from './ChallengesModule';

interface UpcomingCalendarModuleProps {
  isVisible?: boolean;
}

export interface UpcomingCalendarModuleRef {
  createEventFromNl: (nlText: string) => Promise<void>;
}

interface DayData {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  monthName: string;
  isWeekend: boolean;
  events: CalendarEvent[];
}

// Styling constants matching CalendarTab
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  work: { bg: 'bg-blue-950/30', text: 'text-blue-300' },
  personal: { bg: 'bg-purple-950/30', text: 'text-purple-300' },
  health: { bg: 'bg-emerald-950/30', text: 'text-emerald-300' },
  social: { bg: 'bg-pink-950/30', text: 'text-pink-300' },
  learning: { bg: 'bg-amber-950/30', text: 'text-amber-300' },
  travel: { bg: 'bg-cyan-950/30', text: 'text-cyan-300' },
  location: { bg: 'bg-blue-950/40', text: 'text-blue-200' },
  habit_reminder: { bg: 'bg-emerald-950/30', text: 'text-emerald-300' },
};

const ROW_COLORS = {
  default: { bg: 'bg-neutral-900/50', border: 'border-neutral-700' },
  pto: { bg: 'bg-yellow-950/20', border: 'border-yellow-700/30' },
  travel: { bg: 'bg-cyan-950/20', border: 'border-cyan-700/30' },
};

interface RowAppearance {
  bg: string;
  border: string;
  hasPto: boolean;
  ptoOnly: boolean;
}

const getCategoryStyle = (category?: string | null) => {
  return CATEGORY_COLORS[category || ''] || { bg: 'bg-neutral-800/30', text: 'text-neutral-300' };
};

const getCategoryBorderColor = (category?: string | null) => {
  const colorMap: Record<string, string> = {
    work: '#60A5FA',
    personal: '#C084FC',
    health: '#6EE7B7',
    social: '#F9A8D4',
    learning: '#FCD34D',
    travel: '#67E8F9',
    location: '#60A5FA',
    habit_reminder: '#6EE7B7',
  };
  return colorMap[category || ''] || '#737373';
};

const getRowAppearance = (day: DayData): RowAppearance => {
  const ptoEvents = day.events.filter(e => e.is_pto);
  const travelEvents = day.events.filter(e => e.category?.toLowerCase() === 'travel' && e.affects_row_appearance);
  
  const hasPto = ptoEvents.length > 0;
  const hasTravel = travelEvents.length > 0;
  
  if (hasPto) {
    return { ...ROW_COLORS.pto, hasPto: true, ptoOnly: !hasTravel };
  }
  if (hasTravel) {
    return { ...ROW_COLORS.travel, hasPto: false, ptoOnly: false };
  }
  return { ...ROW_COLORS.default, hasPto: false, ptoOnly: false };
};

export const UpcomingCalendarModule = forwardRef<UpcomingCalendarModuleRef, UpcomingCalendarModuleProps>(({ 
  isVisible = true
}, ref) => {
  const [currentWeek, setCurrentWeek] = useState<DayData[]>([]);
  const [nextWeek, setNextWeek] = useState<DayData[]>([]);
  const [weekAfter, setWeekAfter] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  
  // Form state for creating/editing events
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    notes: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    all_day: true,
  });
  
  // Multi-day drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [dragEndDate, setDragEndDate] = useState<string | null>(null);
  const [confirmedRangeStart, setConfirmedRangeStart] = useState<string | null>(null);
  const [confirmedRangeEnd, setConfirmedRangeEnd] = useState<string | null>(null);
  
  // Mobile long press state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  
  // Habit tracking state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<{ habitId: string; date: string; complete: boolean }[]>([]);
  const [habitStats, setHabitStats] = useState<Record<string, HabitYearlyStats>>({});
  
  // Habit emoji mapping - Your 6 habits
  const habitEmojis: Record<string, string> = {
    'working out': '💪',
    'building': '🔨',
    'reading': '📚',
    'writing': '✍️',
    'fasting': '🍽️',
    'no spend': '💰',
  };
  
  const getHabitEmoji = (habitName: string): string => {
    const key = habitName.toLowerCase().trim();
    return habitEmojis[key] || '✓';
  };

  useEffect(() => {
    if (!isVisible) {
      setLoading(false);
      return;
    }
    
    const timer = setTimeout(() => {
      loadUpcomingEvents();
      loadHabitsData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isVisible]);

  // Listen for habit reordering events and reload habits
  useEffect(() => {
    const handleHabitsReordered = () => {
      // Reload habits data when reordered
      loadHabitsData();
    };

    window.addEventListener('dashboard:habits-reordered', handleHabitsReordered as EventListener);
    return () => {
      window.removeEventListener('dashboard:habits-reordered', handleHabitsReordered as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUpcomingEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date();
      const currentYear = today.getFullYear();
      
      // Calculate the Monday of the current week to check for year boundaries
      const todayDayOfWeek = today.getDay();
      const todayDaysFromMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
      const mondayOfWeek = new Date(today);
      mondayOfWeek.setDate(today.getDate() - todayDaysFromMonday);
      
      // Determine which years we need to fetch
      const yearsToFetch = new Set([currentYear]);
      
      // If Monday is in a different year, fetch that year too
      if (mondayOfWeek.getFullYear() !== currentYear) {
        yearsToFetch.add(mondayOfWeek.getFullYear());
      }
      
      // If we're in December, also fetch next year
      if (today.getMonth() === 11) {
        yearsToFetch.add(currentYear + 1);
      }
      
      const eventsPromises = Array.from(yearsToFetch).map(year => 
        apiClient.fetchCalendarEventsForYear(year)
      );
      
      const results = await Promise.all(eventsPromises);
      const events = results.flat();
      setAllEvents(events);
      
      // Generate current week (Monday - Sunday)
      const currentWeekData: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(mondayOfWeek);
        date.setDate(mondayOfWeek.getDate() + i);
        currentWeekData.push(createDayData(date, events));
      }
      
      // Generate next week (Monday - Sunday)
      const mondayOfNextWeek = new Date(mondayOfWeek);
      mondayOfNextWeek.setDate(mondayOfWeek.getDate() + 7);
      
      const nextWeekData: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(mondayOfNextWeek);
        date.setDate(mondayOfNextWeek.getDate() + i);
        nextWeekData.push(createDayData(date, events));
      }
      
      // Generate week after (Monday - Sunday)
      const mondayOfWeekAfter = new Date(mondayOfNextWeek);
      mondayOfWeekAfter.setDate(mondayOfNextWeek.getDate() + 7);
      
      const weekAfterData: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(mondayOfWeekAfter);
        date.setDate(mondayOfWeekAfter.getDate() + i);
        weekAfterData.push(createDayData(date, events));
      }
      
      setCurrentWeek(currentWeekData);
      setNextWeek(nextWeekData);
      setWeekAfter(weekAfterData);
    } catch (error) {
      console.error('Failed to load upcoming calendar events:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to load calendar events';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  const loadHabitsData = async () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      
      // Calculate the Monday of the current week
      const habitsDayOfWeek = today.getDay();
      const habitsDaysFromMonday = habitsDayOfWeek === 0 ? 6 : habitsDayOfWeek - 1;
      const habitsMonday = new Date(today);
      habitsMonday.setDate(today.getDate() - habitsDaysFromMonday);
      
      const mondayYear = habitsMonday.getFullYear();
      
      // Determine which years we need to fetch (handle year boundary)
      const yearsToFetch = [currentYear];
      if (mondayYear !== currentYear) {
        yearsToFetch.push(mondayYear);
      }
      
      // Load habits and entries/stats for all required years
      const [habitsData, ...yearDataResults] = await Promise.all([
        apiClient.fetchHabitsFromSupabase(),
        ...yearsToFetch.flatMap(year => [
          apiClient.fetchHabitEntriesForYear(year),
          apiClient.fetchHabitYearlyStats(year)
        ])
      ]);
      
      // Combine all entries and stats from multiple years
      const allEntries: typeof habitEntries = [];
      const statsMap: Record<string, HabitYearlyStats> = {};
      
      for (let i = 0; i < yearsToFetch.length; i++) {
        const entriesData = yearDataResults[i * 2] as typeof habitEntries;
        const statsData = yearDataResults[i * 2 + 1] as HabitYearlyStats[];
        
        allEntries.push(...entriesData);
        
        // Stats for current year take precedence
        if (yearsToFetch[i] === currentYear) {
          statsData.forEach(stat => {
            statsMap[stat.habit_id] = stat;
          });
        } else {
          // Only add stats if not already present
          statsData.forEach(stat => {
            if (!statsMap[stat.habit_id]) {
              statsMap[stat.habit_id] = stat;
            }
          });
        }
      }
      
      setHabits(habitsData);
      setHabitEntries(allEntries);
      setHabitStats(statsMap);
    } catch (err) {
      console.error('Failed to load habits data:', err);
    }
  };

  const createDayData = (date: Date, events: CalendarEvent[]): DayData => {
    const dateStr = formatDateToYYYYMMDD(date);
    const dayOfWeek = date.getDay();
    
    return {
      date: dateStr,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString('en-US', { month: 'long' }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      events: getEventsForDate(events, dateStr)
    };
  };

  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Helper to check if habit was completed on a specific date
  const isHabitCompletedOnDate = (habitId: string, dateStr: string): boolean => {
    return habitEntries.some(entry => 
      entry.habitId === habitId && 
      entry.date === dateStr && 
      entry.complete
    );
  };
  
  // Calculate current week habit progress
  const getCurrentWeekProgress = () => {
    if (currentWeek.length === 0) return [];
    
    const startDate = currentWeek[0].date;
    const endDate = currentWeek[6].date;
    
    return habits.map(habit => {
      const weeklyGoal = habitStats[habit.id]?.weekly_goal || 0;
      const completions = habitEntries.filter(
        entry => entry.habitId === habit.id && 
                 entry.complete && 
                 entry.date >= startDate && 
                 entry.date <= endDate
      ).length;
      
      return {
        habit,
        completions,
        goal: weeklyGoal,
        goalMet: weeklyGoal > 0 && completions >= weeklyGoal
      };
    });
  };

  const getEventsForDate = (events: CalendarEvent[], dateStr: string): CalendarEvent[] => {
    return events.filter(event => {
      return dateStr >= event.start_date && dateStr <= event.end_date;
    }).sort((a, b) => {
      if (a.all_day && !b.all_day) return -1;
      if (!a.all_day && b.all_day) return 1;
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      return 0;
    });
  };

  
  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsCreating(false);
    setFormData({
      title: event.title,
      category: event.category || '',
      notes: event.notes || '',
      start_date: event.start_date,
      end_date: event.end_date,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      all_day: event.all_day,
    });
  };
  
  const handleSaveEvent = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    try {
      const input: CalendarEventInput = {
        title: formData.title,
        category: formData.category,
        notes: formData.notes || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        all_day: formData.all_day,
        affects_row_appearance: false,
        priority: 3,
        is_pto: false,
        source_pattern_id: null,
      };
      
      if (editingEvent) {
        // Update existing event
        await apiClient.updateCalendarEvent(editingEvent.id, input);
        const updatedEvents = allEvents.map(e => 
          e.id === editingEvent.id 
            ? { ...e, ...input, updated_at: new Date().toISOString() }
            : e
        );
        setAllEvents(updatedEvents);
        regenerateWeeks(updatedEvents);
        toast.success('Event updated');
      } else {
        // Create new event
        const newId = await apiClient.createCalendarEvent(input);
        const newEvent: CalendarEvent = {
          id: newId,
          ...input,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const updatedEvents = [...allEvents, newEvent];
        setAllEvents(updatedEvents);
        regenerateWeeks(updatedEvents);
        toast.success('Event created');
      }
      
      // Close modal and clear drag states
      setIsCreating(false);
      setEditingEvent(null);
      setSelectedDate(null);
      setDragEndDate(null);
      setConfirmedRangeStart(null);
      setConfirmedRangeEnd(null);
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Failed to save event');
    }
  };

  // Multi-day drag selection handlers
  const handleDragStart = (date: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartDate(date);
    setDragEndDate(date);
    setSelectedDate(date);
  };

  const handleDragOver = (date: string) => {
    if (isDragging && dragStartDate) {
      setDragEndDate(date);
    }
  };

  const handleDragEnd = () => {
    if (isDragging && dragStartDate && dragEndDate) {
      // Confirm the range
      const start = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
      const end = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;
      
      // Only create multi-day event if more than one day selected
      if (start !== end) {
      setConfirmedRangeStart(start);
      setConfirmedRangeEnd(end);
      setSelectedDate(start);
        setDragEndDate(end);
        setIsCreating(true);
        setEditingEvent(null);
        setIsDragging(false);
        setDragStartDate(null);
        return; // Keep dragEndDate for the form
      } else {
        // Single day - open event form
        setSelectedDate(dragStartDate);
        setFormData({
          title: '',
          category: '',
          notes: '',
          start_date: dragStartDate,
          end_date: dragStartDate,
          start_time: '',
          end_time: '',
          all_day: true,
        });
        setIsCreating(true);
        setEditingEvent(null);
      }
    }
    setIsDragging(false);
    setDragStartDate(null);
    setDragEndDate(null);
  };

  // Mobile touch handlers for long press + drag
  const handleTouchStart = (date: string, e: React.TouchEvent) => {
    // Don't start if touching an event
    if ((e.target as HTMLElement).closest('.group\\/event, .group\\/location')) {
      return;
    }

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    
    // Start long press timer (500ms)
    const timer = setTimeout(() => {
      setIsLongPressActive(true);
      setIsDragging(true);
      setDragStartDate(date);
      setDragEndDate(date);
      setConfirmedRangeStart(null);
      setConfirmedRangeEnd(null);
      
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
    
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    // If long press hasn't activated yet, check if user moved too much (cancel long press)
    if (!isLongPressActive && touchStartPos && longPressTimer) {
      const deltaX = Math.abs(touch.clientX - touchStartPos.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.y);
      
      // If moved more than 10px, cancel long press (user is scrolling)
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
        setTouchStartPos(null);
      }
      return;
    }
    
    // If long press is active and dragging, find the element under the touch
    if (isLongPressActive && isDragging && dragStartDate) {
      e.preventDefault(); // Prevent scrolling during drag selection
      
      // Find element at touch position
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const dayButton = element?.closest('[data-date]');
      
      if (dayButton) {
        const date = dayButton.getAttribute('data-date');
        if (date) {
          setDragEndDate(date);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    // Clean up long press timer if still pending
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // If long press was active, finalize the selection
    if (isLongPressActive) {
      handleDragEnd();
      setIsLongPressActive(false);
    }
    
    setTouchStartPos(null);
  };

  const getSelectedRange = () => {
    if (confirmedRangeStart && confirmedRangeEnd) {
      return { start: confirmedRangeStart, end: confirmedRangeEnd };
    }
    if (isDragging && dragStartDate && dragEndDate) {
      const start = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
      const end = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;
      return { start, end };
    }
    return null;
  };

  const regenerateWeeks = (events: CalendarEvent[]) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const mondayOfCurrentWeek = new Date(today);
    mondayOfCurrentWeek.setDate(today.getDate() - daysFromMonday);
    
    // Generate current week
    const currentWeekData: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfCurrentWeek);
      date.setDate(mondayOfCurrentWeek.getDate() + i);
      currentWeekData.push(createDayData(date, events));
    }
    
    // Generate next week
    const mondayOfNextWeek = new Date(mondayOfCurrentWeek);
    mondayOfNextWeek.setDate(mondayOfCurrentWeek.getDate() + 7);
    
    const nextWeekData: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfNextWeek);
      date.setDate(mondayOfNextWeek.getDate() + i);
      nextWeekData.push(createDayData(date, events));
    }
    
    // Generate week after
    const mondayOfWeekAfter = new Date(mondayOfNextWeek);
    mondayOfWeekAfter.setDate(mondayOfNextWeek.getDate() + 7);
    
    const weekAfterData: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeekAfter);
      date.setDate(mondayOfWeekAfter.getDate() + i);
      weekAfterData.push(createDayData(date, events));
    }
    
    setCurrentWeek(currentWeekData);
    setNextWeek(nextWeekData);
    setWeekAfter(weekAfterData);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await apiClient.deleteCalendarEvent(eventId);
      
      // Optimistically update local state without refreshing
      const updatedEvents = allEvents.filter(e => e.id !== eventId);
      setAllEvents(updatedEvents);
      regenerateWeeks(updatedEvents);
      
      toast.success('Event deleted');
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
      // On error, do a full refresh
      await loadUpcomingEvents();
    }
  };
  
  const handleHabitCircleClick = async (
    habit: Habit, 
    date: string, 
    hasPlannedEvent: boolean,
    isFuture: boolean
  ) => {
    if (isFuture) {
      // Future date - create or delete calendar event
      if (hasPlannedEvent) {
        // Find and delete the planned event
        const plannedEvent = allEvents.find(e => 
          e.category === 'habit_reminder' &&
          e.title.toLowerCase().includes(habit.name.toLowerCase()) &&
          e.start_date <= date && 
          e.end_date >= date
        );
        
        if (plannedEvent) {
          await handleDeleteEvent(plannedEvent.id);
          toast.success(`Removed plan: ${habit.name}`);
        }
      } else {
        // Create new habit reminder event
        try {
          const input: CalendarEventInput = {
            title: habit.name,
            category: 'habit_reminder',
            notes: null,
            start_date: date,
            end_date: date,
            start_time: null,
            end_time: null,
            all_day: true,
            affects_row_appearance: false,
            priority: 3,
            is_pto: false,
            source_pattern_id: null,
          };
          
          const newId = await apiClient.createCalendarEvent(input);
          const newEvent: CalendarEvent = {
            id: newId,
            ...input,
            user_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          const updatedEvents = [...allEvents, newEvent];
          setAllEvents(updatedEvents);
          regenerateWeeks(updatedEvents);
          toast.success(`Planned: ${habit.name}`);
        } catch (error) {
          console.error('Failed to create habit reminder:', error);
          toast.error('Failed to create plan');
        }
      }
    } else {
      // Past or today - toggle habit completion
      const isCompleted = isHabitCompletedOnDate(habit.id, date);
      const nextVal = !isCompleted;
      
      try {
        // Optimistically update local state
        setHabitEntries(prev => {
          const filtered = prev.filter(e => !(e.habitId === habit.id && e.date === date));
          if (nextVal) {
            return [...filtered, { habitId: habit.id, date, complete: true }];
          }
          return filtered;
        });
        
        // Save to database
        const res = await apiClient.upsertHabitEntry({ 
          habitId: habit.id, 
          date, 
          isDone: nextVal, 
          source: 'calendar' 
        });
        
        if (!res.success) {
          throw new Error(res.error || 'Failed to save');
        }
        
        // Reload habit data to sync with database
        await loadHabitsData();
        
        toast.success(nextVal ? `Completed: ${habit.name}` : `Unchecked: ${habit.name}`);
      } catch (error) {
        console.error('Failed to toggle habit:', error);
        toast.error('Failed to save habit');
        
        // Rollback optimistic update
        await loadHabitsData();
      }
    }
  };

  const createEventFromNl = async (nlText: string) => {
    if (!nlText.trim()) return;
    
    try {
      const parsedEvent = await apiClient.parseNaturalLanguageEvent(nlText);
      const input: CalendarEventInput = {
        title: parsedEvent.title,
        category: parsedEvent.category || '',
        notes: parsedEvent.notes,
        start_date: parsedEvent.start_date,
        end_date: parsedEvent.end_date,
        start_time: parsedEvent.start_time,
        end_time: parsedEvent.end_time,
        all_day: parsedEvent.all_day,
        affects_row_appearance: false,
        priority: 3,
        is_pto: false,
        source_pattern_id: null,
      };
      const newId = await apiClient.createCalendarEvent(input);
      const newEvent: CalendarEvent = {
        id: newId,
        ...input,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAllEvents(prev => [...prev, newEvent]);
      await loadUpcomingEvents();
      toast.success(`Created: ${parsedEvent.title}`);
    } catch (error) {
      console.error('Failed to parse natural language event:', error);
      toast.error('Failed to create event');
    }
  };
  
  // Expose method to parent
  useImperativeHandle(ref, () => ({
    createEventFromNl
  }));

  const renderWeekRow = (weekData: DayData[], label: string) => {
    const today = formatDateToYYYYMMDD(new Date());
    const selectedRange = getSelectedRange();
    
    
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-400">{label}</h3>
        
        {/* Desktop: 7-column grid layout */}
        <div className="hidden md:grid md:grid-cols-7 gap-2">
          {weekData.map((day) => {
            const isToday = day.date === today;
            const isPast = day.date < today;
            const isSelected = selectedDate === day.date;
            const rowAppearance = getRowAppearance(day);
            
            // Check if day is in selected range
            const isInDragRange = selectedRange && 
              day.date >= selectedRange.start && 
              day.date <= selectedRange.end;

            return (
              <div key={day.date} className="relative group/day">
                <button
                  data-date={day.date}
                  onMouseDown={(e) => handleDragStart(day.date, e)}
                  onMouseEnter={() => handleDragOver(day.date)}
                  className={cn(
                    'w-full h-full min-h-[120px] text-left p-3 rounded-lg border transition-all',
                    'hover:bg-neutral-800/50',
                    'flex flex-col',
                    isPast && 'opacity-50',
                    isInDragRange && 'bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500/50',
                    !isInDragRange && isSelected && 'bg-neutral-800 border-emerald-500 ring-2 ring-emerald-500/30',
                    !isInDragRange && !isSelected && rowAppearance.bg,
                    !isInDragRange && !isSelected && rowAppearance.border,
                    isToday && !isSelected && !isInDragRange && 'ring-2 ring-emerald-400/50',
                    isDragging && 'select-none',
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-700/50">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs font-medium uppercase',
                        day.isWeekend ? 'text-emerald-400' : 'text-neutral-500'
                      )}>
                        {day.dayOfWeek}
                      </span>
                      {rowAppearance.hasPto && (
                        <div className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-300 shadow-sm" title="PTO" />
                      )}
                    </div>
                    <span className={cn(
                      'text-2xl font-bold',
                      day.isWeekend ? 'text-emerald-300' : 'text-neutral-100'
                    )}>
                      {day.dayNumber}
                    </span>
                  </div>
                  
                  {/* Habit Circles Row - Centered under date */}
                  <div className="flex gap-1.5 items-center justify-center pt-1 pb-2">
                    {habits.slice(0, 6).map((habit) => {
                      const isCompleted = isHabitCompletedOnDate(habit.id, day.date);
                      const isFuture = day.date > today;
                      
                      // Check if there's a planned event for this habit on this day
                      const hasPlannedEvent = allEvents.some(e => 
                        e.category === 'habit_reminder' &&
                        e.title.toLowerCase().includes(habit.name.toLowerCase()) &&
                        e.start_date <= day.date && 
                        e.end_date >= day.date
                      );
                      
                      const emoji = getHabitEmoji(habit.name);
                      
                      return (
                        <button
                          key={habit.id}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHabitCircleClick(habit, day.date, hasPlannedEvent, isFuture);
                          }}
                          className={cn(
                            'w-3.5 h-3.5 rounded-full transition-all cursor-pointer relative flex items-center justify-center text-[10px]',
                            'hover:scale-125 group/habit',
                            isCompleted && 'bg-emerald-600 border-none',
                            !isCompleted && isFuture && hasPlannedEvent && 'bg-white/90 border-none',
                            !isCompleted && !hasPlannedEvent && 'bg-neutral-800 border border-neutral-700 opacity-50'
                          )}
                          title={habit.name}
                        >
                          <span className={cn(
                            'leading-none',
                            isCompleted && 'opacity-100',
                            !isCompleted && isFuture && hasPlannedEvent && 'opacity-80',
                            !isCompleted && !hasPlannedEvent && 'opacity-60'
                          )}>
                            {emoji}
                          </span>
                          
                          {/* Hover tooltip */}
                          <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover/habit:opacity-100 transition-opacity delay-300 bg-neutral-800 border border-neutral-700 px-2 py-1 rounded text-[10px] text-neutral-200 pointer-events-none z-10 shadow-lg">
                            {habit.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Location display - below habits, above events */}
                  {day.events.some(e => e.category === 'location') && (
                    <div 
                      className="group/location relative px-2 py-1 mb-1 bg-blue-950/30 border border-blue-700/30 rounded text-[10px] text-blue-300 truncate hover:bg-blue-950/40 transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>📍 {day.events.find(e => e.category === 'location')?.title}</span>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const locationEvent = day.events.find(ev => ev.category === 'location');
                          if (locationEvent) handleDeleteEvent(locationEvent.id);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-blue-400 hover:text-blue-200 hover:bg-blue-900/50 rounded opacity-0 group-hover/location:opacity-100 transition-opacity"
                        title="Remove location"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  
                  {/* Events - Full width below location */}
                  <div className="flex-1 space-y-1 overflow-y-auto min-w-0">
                    {day.events
                      .filter(event => !event.is_pto && event.category !== 'location')
                      .map(event => {
                        const style = getCategoryStyle(event.category);
                        const borderColor = getCategoryBorderColor(event.category);
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              'group/event flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer',
                              'hover:bg-neutral-700/50 transition-all border-l-2',
                              style.bg
                            )}
                            style={{ borderLeftColor: borderColor }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                          >
                            <div className={cn('flex-1 min-w-0 text-[11px] font-medium break-words leading-tight', style.text)}>
                              {event.title}
                            </div>
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(event.id);
                              }}
                              className="opacity-0 group-hover/event:opacity-100 text-neutral-400 hover:text-rose-400 transition-all flex-shrink-0"
                              title="Delete event"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        
        {/* Mobile: Compact row layout (similar to Calendar Tab mobile) */}
        <div className="md:hidden space-y-2">
          {weekData.map((day) => {
            const isToday = day.date === today;
            const isPast = day.date < today;
            const isSelected = selectedDate === day.date;
            const rowAppearance = getRowAppearance(day);
            const isInDragRange = selectedRange && 
              day.date >= selectedRange.start && 
              day.date <= selectedRange.end;
            
            return (
                <button
                key={day.date}
                data-date={day.date}
                onClick={() => {
                  if (!isDragging) {
                    setSelectedDate(day.date);
                    setFormData({
                      title: '',
                      category: '',
                      notes: '',
                      start_date: day.date,
                      end_date: day.date,
                      start_time: '',
                      end_time: '',
                      all_day: true,
                    });
                    setIsCreating(true);
                    setEditingEvent(null);
                  }
                  }}
                onTouchStart={(e) => handleTouchStart(day.date, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                  className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                  'hover:bg-neutral-800/50',
                  isPast && 'opacity-50',
                  isInDragRange && 'bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500/50',
                  !isInDragRange && isSelected && 'bg-neutral-800 border-emerald-500',
                  !isInDragRange && !isSelected && rowAppearance.bg,
                  !isInDragRange && !isSelected && rowAppearance.border,
                  isToday && !isSelected && !isInDragRange && 'ring-2 ring-emerald-400/50',
                  isDragging && 'select-none',
                )}
              >
                {/* Mobile Layout: Date | Content */}
                <div className="flex gap-3">
                  {/* Left: Date info */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn(
                      'text-sm font-medium w-9',
                      day.isWeekend ? 'text-emerald-400' : 'text-neutral-400'
                    )}>
                      {day.dayOfWeek}
                    </span>
                    <div className="w-2.5 flex items-center justify-center flex-shrink-0">
                      {rowAppearance.hasPto && (
                        <div className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-300 shadow-sm" title="PTO" />
                      )}
                    </div>
                    <span className={cn(
                      'text-lg font-semibold w-8',
                      day.isWeekend ? 'text-emerald-300' : 'text-neutral-100'
                    )}>
                      {day.dayNumber}
                    </span>
                  </div>
                  
                  {/* Right: Content column */}
                  <div className="flex-1 space-y-2 min-w-0">
                    {/* Habit Circles Row */}
                    {habits.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {habits.slice(0, 6).map((habit) => {
                          const isCompleted = isHabitCompletedOnDate(habit.id, day.date);
                          const isFuture = day.date > today;
                          const hasPlannedEvent = allEvents.some(e => 
                            e.category === 'habit_reminder' &&
                            e.title.toLowerCase().includes(habit.name.toLowerCase()) &&
                            e.start_date <= day.date && 
                            e.end_date >= day.date
                          );
                          const emoji = getHabitEmoji(habit.name);
                          
                          return (
                            <button
                              key={habit.id}
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHabitCircleClick(habit, day.date, hasPlannedEvent, isFuture);
                              }}
                              className={cn(
                                'w-5 h-5 rounded-full transition-all cursor-pointer flex items-center justify-center text-xs',
                                isCompleted && 'bg-emerald-600 border-none',
                                !isCompleted && isFuture && hasPlannedEvent && 'bg-white/90 border-none',
                                !isCompleted && !hasPlannedEvent && 'bg-neutral-800 border border-neutral-700 opacity-50'
                              )}
                              title={habit.name}
                            >
                              <span className={cn(
                                'leading-none',
                                isCompleted && 'opacity-100',
                                !isCompleted && isFuture && hasPlannedEvent && 'opacity-80',
                                !isCompleted && !hasPlannedEvent && 'opacity-60'
                              )}>
                                {emoji}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Location facet */}
                    {day.events.some(e => e.category === 'location') && (
                      <div 
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-950/30 border border-blue-700/30 rounded text-xs text-blue-300"
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">📍 {day.events.find(e => e.category === 'location')?.title}</span>
                        <button
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const locationEvent = day.events.find(ev => ev.category === 'location');
                            if (locationEvent) handleDeleteEvent(locationEvent.id);
                          }}
                          className="flex-shrink-0 text-blue-400 hover:text-blue-200 p-0.5"
                          title="Remove location"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    {/* Event pills */}
                    {day.events
                      .filter(event => !event.is_pto && event.category !== 'location')
                      .map(event => {
                        const style = getCategoryStyle(event.category);
                        const borderColor = getCategoryBorderColor(event.category);
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              'group/event flex items-center gap-1.5 px-2 py-1 rounded border-l-2',
                              style.bg
                            )}
                            style={{ borderLeftColor: borderColor }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                          >
                            <div className={cn('flex-1 text-[11px] font-medium truncate', style.text)}>
                              {event.title}
                            </div>
                            <button
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(event.id);
                              }}
                              className="text-neutral-400 hover:text-rose-400 flex-shrink-0"
                              title="Delete"
                            >
                              <X className="w-3 h-3" />
                </button>
              </div>
                        );
                      })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Add mouseup listener for drag end
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, dragStartDate, dragEndDate]);

  // Cleanup long press timer on unmount or when cancelled
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Update form data when creating multi-day event or editing
  useEffect(() => {
    if (editingEvent) {
      // Editing existing event
      setFormData({
        title: editingEvent.title,
        category: editingEvent.category || '',
        notes: editingEvent.notes || '',
        start_date: editingEvent.start_date,
        end_date: editingEvent.end_date,
        start_time: editingEvent.start_time || '',
        end_time: editingEvent.end_time || '',
        all_day: editingEvent.all_day ?? true,
      });
    } else if (isCreating && selectedDate) {
      // Creating new event - use drag end date if available
      const endDate = dragEndDate || selectedDate;
      setFormData({
        title: '',
        category: '',
        notes: '',
        start_date: selectedDate,
        end_date: endDate,
        start_time: '',
        end_time: '',
        all_day: true,
      });
    }
  }, [editingEvent, isCreating, selectedDate, dragEndDate]);

  if (!isVisible) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
          <div className={tokens.palette.dark.text_muted}>Loading calendar...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="text-red-500 text-sm mb-2">{error}</div>
          <button onClick={loadUpcomingEvents} className="text-xs text-emerald-400 hover:text-emerald-300">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const weekProgress = getCurrentWeekProgress();
  
  // Render challenges and habit goals section
  const renderChallengesAndGoals = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Challenges Module */}
        <ChallengesModule habitStats={habitStats} />
        
        {/* Habit Progress Stats */}
        {habits.length > 0 && currentWeek.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-neutral-400 mb-3">Habit Goals</h4>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {weekProgress.map((item) => {
              const emoji = getHabitEmoji(item.habit.name);
              const badges = [];
              
              // Create array of badges (goal determines total, completions determines filled)
              for (let i = 0; i < item.goal; i++) {
                badges.push(i < item.completions);
              }
                
                return (
                <div key={item.habit.id} className="flex flex-col gap-2">
                  {/* Habit name - white text */}
                    <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-100">
                        {item.habit.name}
                      </span>
                      <span className={cn(
                        "text-xs font-semibold tabular-nums",
                        item.goalMet ? 'text-emerald-400' : 'text-neutral-400'
                      )}>
                        {item.completions} / {item.goal}
                      </span>
                    </div>
                    
                  {/* Badge Collection */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {badges.map((isUnlocked, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all',
                          isUnlocked 
                            ? 'bg-emerald-500/20 border border-emerald-500/50' 
                            : 'bg-neutral-800/50 border border-neutral-700 opacity-40'
                        )}
                        title={isUnlocked ? 'Unlocked' : 'Locked'}
                      >
                        {isUnlocked ? emoji : '🔒'}
                      </div>
                    ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-neutral-400 mb-3">Habit Goals</h4>
            <div className="text-xs text-neutral-500 italic">
              No habits configured
            </div>
          </div>
        )}
      </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Mobile: Challenges and Habit Goals ABOVE weeks */}
      <div className="md:hidden">
        {renderChallengesAndGoals()}
      </div>
      
      {/* This Week */}
      {currentWeek.length > 0 && renderWeekRow(currentWeek, 'This Week')}
      
      {/* Desktop: Challenges and Habit Goals AFTER first week */}
      <div className="hidden md:block">
        {renderChallengesAndGoals()}
      </div>
      
      {/* Remaining Weeks */}
      {nextWeek.length > 0 && renderWeekRow(nextWeek, 'Next Week')}
      
      {weekAfter.length > 0 && renderWeekRow(weekAfter, 'Week After')}
      
      {/* Simple Event Modal */}
      {(selectedDate || editingEvent) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
          setSelectedDate(null);
          setIsCreating(false);
          setEditingEvent(null);
          setDragEndDate(null);
          setConfirmedRangeStart(null);
          setConfirmedRangeEnd(null);
        }}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-100">
                {editingEvent ? 'Edit Event' : `Add Event${selectedDate ? ` - ${selectedDate}` : ''}`}
              </h3>
              <button 
                onClick={() => {
                  setSelectedDate(null);
                  setIsCreating(false);
                  setEditingEvent(null);
                  setDragEndDate(null);
                  setConfirmedRangeStart(null);
                  setConfirmedRangeEnd(null);
                }}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {(isCreating || editingEvent) && (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Dentist, Team Meeting"
                    autoFocus
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">None</option>
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="health">Health</option>
                    <option value="social">Social</option>
                    <option value="learning">Learning</option>
                    <option value="travel">Travel</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={formData.all_day}
                      onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
                      className="rounded"
                    />
                    All day event
                  </label>
                </div>
                
                {!formData.all_day && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows={3}
                    placeholder="Optional notes..."
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
                  >
                    {editingEvent ? 'Update' : 'Create'} Event
                  </button>
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteEvent(editingEvent.id);
                        setSelectedDate(null);
                        setIsCreating(false);
                        setEditingEvent(null);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(null);
                      setIsCreating(false);
                      setEditingEvent(null);
                    }}
                    className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

UpcomingCalendarModule.displayName = 'UpcomingCalendarModule';

export default UpcomingCalendarModule;
