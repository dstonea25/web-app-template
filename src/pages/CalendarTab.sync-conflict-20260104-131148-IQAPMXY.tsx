import React, { useState, useEffect, useMemo, useRef, useTransition, useCallback } from 'react';
import { tokens, cn } from '../theme/config';
import { Calendar, X, Plus, Edit2, Trash2, Settings, ChevronRight, ChevronDown, Sparkles, BarChart3 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';
import type { CalendarEvent, CalendarEventInput } from '../types';

interface CalendarTabProps {
  isVisible?: boolean;
}

// Category colors for event pills (dot + text)
const CATEGORY_COLORS: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  vacation: { dot: 'bg-purple-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  holiday: { dot: 'bg-rose-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  travel: { dot: 'bg-teal-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  medical: { dot: 'bg-orange-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  social: { dot: 'bg-amber-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  work: { dot: 'bg-blue-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  personal: { dot: 'bg-neutral-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
};

// Row appearance colors (ONLY for PTO, Travel, and Weekends)
const ROW_COLORS: Record<string, { bg: string; border: string }> = {
  pto: { bg: 'bg-yellow-950/40', border: 'border-yellow-700/50' },  // Golden for PTO
  travel: { bg: 'bg-teal-950/30', border: 'border-teal-800/40' },   // Teal for travel
  weekend: { bg: 'bg-emerald-950/20', border: 'border-emerald-900/30' }, // Emerald for weekends
  default: { bg: 'bg-neutral-900', border: 'border-neutral-800' },
};

// Priority values - ONLY for row appearance (PTO, Travel, Weekend)
const PRIORITY_VALUES: Record<string, number> = {
  pto: 10,      // PTO always wins
  travel: 7,    // Travel
  weekend: 5,   // Baseline special day
  default: 1,
};

const getCategoryStyle = (category: string | null | undefined) => {
  if (!category) return CATEGORY_COLORS.personal;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.personal;
};

// Map category to actual hex color for borders
const getCategoryBorderColor = (category: string | null | undefined): string => {
  const categoryMap: Record<string, string> = {
    vacation: '#a855f7',  // purple-500
    holiday: '#f43f5e',   // rose-500
    travel: '#14b8a6',    // teal-500
    medical: '#f97316',   // orange-500
    social: '#f59e0b',    // amber-500
    work: '#3b82f6',      // blue-500
    personal: '#737373',  // neutral-500
  };
  if (!category) return categoryMap.personal;
  return categoryMap[category.toLowerCase()] || categoryMap.personal;
};

const getDefaultPriority = (category: string | null): number => {
  // Only travel gets default affects_row_appearance
  if (category?.toLowerCase() === 'travel') return PRIORITY_VALUES.travel;
  return PRIORITY_VALUES.default;
};

interface RowAppearance {
  bg: string;
  border: string;
  hasPto: boolean;  // Whether to show gold dot indicator
  ptoOnly: boolean; // Whether this is PTO-only (golden background)
}

const getRowAppearance = (day: DayData): RowAppearance => {
  // Check for PTO events
  const ptoEvents = day.events.filter(e => e.is_pto);
  const travelEvents = day.events.filter(e => e.category?.toLowerCase() === 'travel' && e.affects_row_appearance);
  
  const hasPto = ptoEvents.length > 0;
  const hasTravel = travelEvents.length > 0;
  
  // Priority: PTO > Travel > Weekend > Default
  
  // If PTO exists → Golden row
  if (hasPto) {
    return {
      ...ROW_COLORS.pto,
      hasPto: true,
      ptoOnly: !hasTravel, // Show if not combined with travel
    };
  }
  
  // If Travel exists → Teal row
  if (hasTravel) {
    return {
      ...ROW_COLORS.travel,
      hasPto: false,
      ptoOnly: false,
    };
  }
  
  // If Weekend → Emerald row
  if (day.isWeekend) {
    return {
      ...ROW_COLORS.weekend,
      hasPto: false,
      ptoOnly: false,
    };
  }
  
  // Default (no special row color)
  return {
    ...ROW_COLORS.default,
    hasPto: false,
    ptoOnly: false,
  };
};

interface DayData {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Mon, Tue, etc.
  dayNumber: number; // 1-31
  isWeekend: boolean;
  monthName: string; // January, February, etc.
  monthIndex: number; // 0-11
  events: CalendarEvent[];
}

export const CalendarTab: React.FC<CalendarTabProps> = ({ isVisible }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  
  const [isPending, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null); // For event detail modal
  const [showPastMonths, setShowPastMonths] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar-show-past-months');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [snapToToday, setSnapToToday] = useState(() => {
    try {
      return localStorage.getItem('calendar-snap-to-today') === 'true';
    } catch {
      return false;
    }
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMonthIndex, setShowMonthIndex] = useState(false); // Auto-hide month index
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [renderedDays, setRenderedDays] = useState<DayData[]>([]); // Progressive rendering
  
  // Quick add input state
  const [nlInput, setNlInput] = useState('');
  const [showNlPanel, setShowNlPanel] = useState(false);
  const [showNlSheet, setShowNlSheet] = useState(false); // Mobile bottom sheet
  const [isYearHeaderVisible, setIsYearHeaderVisible] = useState(true); // Track year header visibility
  const [activeMonthDropdown, setActiveMonthDropdown] = useState<string | null>(null); // Which month's dropdown is open
  
  // Animated placeholder
  const [placeholderText, setPlaceholderText] = useState('');
  const examples = [
    'Dentist Thursday 2pm',
    'Bahamas Jan 11-12',
    'PTO next week'
  ];
  
  // Typewriter animation for placeholder (runs once)
  useEffect(() => {
    if (nlInput) return; // Don't animate if user is typing
    
    let exampleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;
    
    const animate = () => {
      const currentExample = examples[exampleIndex];
      
      if (!isDeleting) {
        // Typing
        if (charIndex < currentExample.length) {
          setPlaceholderText(currentExample.slice(0, charIndex + 1));
          charIndex++;
          timeoutId = setTimeout(animate, 50); // Typing speed
        } else {
          // Pause at end
          timeoutId = setTimeout(() => {
            isDeleting = true;
            animate();
          }, 2000); // Pause before deleting
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setPlaceholderText(currentExample.slice(0, charIndex - 1));
          charIndex--;
          timeoutId = setTimeout(animate, 30); // Delete speed (faster)
        } else {
          // Move to next example
          exampleIndex++;
          if (exampleIndex < examples.length) {
            isDeleting = false;
            timeoutId = setTimeout(animate, 500); // Pause before next example
          } else {
            // Done - show last example
            setPlaceholderText(examples[examples.length - 1]);
          }
        }
      }
    };
    
    timeoutId = setTimeout(animate, 1000); // Initial delay
    
    return () => clearTimeout(timeoutId);
  }, [nlInput]);
  
  // Multi-day drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [dragEndDate, setDragEndDate] = useState<string | null>(null);
  const [confirmedRangeStart, setConfirmedRangeStart] = useState<string | null>(null);
  const [confirmedRangeEnd, setConfirmedRangeEnd] = useState<string | null>(null);
  
  // Mobile long press state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  
  // Track which months are expanded (default: current month + all future)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const today = new Date();
    const expanded = new Set<string>();
    
    // Expand current month + all future months
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    for (let year = currentYear; year <= currentYear + 1; year++) {
      const startMonth = year === currentYear ? currentMonth : 0;
      const endMonth = 11;
      
      for (let month = startMonth; month <= endMonth; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        expanded.add(key);
      }
    }
    
    return expanded;
  });
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const topRef = useRef<HTMLDivElement>(null); // Ref for scrolling to top
  const monthIndexTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For auto-hide
  const hasLoadedPast = useRef(false);
  const nlPanelRef = useRef<HTMLDivElement>(null);
  const nlInputRef = useRef<HTMLInputElement>(null);
  const nlSheetInputRef = useRef<HTMLInputElement>(null);

  // Note: Removed deferredValue since we're using progressive rendering now
  // Progressive rendering already handles non-blocking updates

  // Helper to parse date string in local time (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  // Toggle month expansion
  const toggleMonth = (year: number, monthIndex: number) => {
    const key = `${year}-${String(monthIndex).padStart(2, '0')}`;
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Calculate date range based on selectedYear and Q4 logic
  const { startYear, endYear } = useMemo(() => {
    let endYr = selectedYear;
    
    if (selectedYear === currentYear && currentMonth >= 9) {
      // Q4 of current year: extend into next year
      endYr = selectedYear + 1;
    }
    
    return {
      startYear: selectedYear,
      endYear: endYr,
    };
  }, [selectedYear, currentYear, currentMonth]);

  // Helper: Generate days between two dates
  const generateDaysInRange = (startDate: Date, endDate: Date): DayData[] => {
    const days: DayData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      days.push({
        date: dateStr,
        dayOfWeek,
        dayNumber: currentDate.getDate(),
        isWeekend,
        monthName,
        monthIndex: currentDate.getMonth(),
        events: [],
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  // SINGLE EFFECT: Handle all day generation with TWO PATHS
  useEffect(() => {
    if (!isVisible) return;
    
    // Reset guards when year/mode changes
    hasLoadedPast.current = false;
    
    // Both modes: Render all days from year start to year end
    const yearStart = new Date(startYear, 0, 1);
    const yearEnd = new Date(endYear, 11, 31, 23, 59, 59);
    const allDays = generateDaysInRange(yearStart, yearEnd);
    
    setRenderedDays(allDays);
    setIsLoading(false);
    
    // If snap-to-today is enabled, we'll scroll to today in useLayoutEffect
    
  }, [isVisible, selectedYear, startYear, endYear, snapToToday]);

  // Scroll to today when snap-to-today is enabled
  useEffect(() => {
    if (!snapToToday || !isVisible || renderedDays.length === 0) return;
    
    // Multiple attempts with increasing delays to ensure DOM is ready
    const attempts = [100, 300, 500];
    const timeouts: NodeJS.Timeout[] = [];
    
    attempts.forEach(delay => {
      const timeout = setTimeout(() => {
        if (todayRef.current) {
          todayRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start', // Respects scroll-margin-top for offset
            inline: 'nearest'
          });
          // Clear remaining timeouts
          timeouts.forEach(t => clearTimeout(t));
        }
      }, delay);
      timeouts.push(timeout);
    });
    
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [snapToToday, isVisible, renderedDays.length]);

  // Use rendered days
  const daysData = renderedDays;

  // Map events to days (handling multi-day events)
  const daysWithEvents = useMemo(() => {
    const eventsByDate = new Map<string, CalendarEvent[]>();
    
    // For each event, map it to all days it spans
    events.forEach(event => {
      const startDate = parseLocalDate(event.start_date);
      const endDate = parseLocalDate(event.end_date);
      
      // Iterate through each day in the event's range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const existing = eventsByDate.get(dateStr) || [];
        existing.push(event);
        eventsByDate.set(dateStr, existing);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return daysData.map(day => ({
      ...day,
      events: eventsByDate.get(day.date) || [],
    }));
  }, [daysData, events]);

  // Filter days based on showPastMonths
  const visibleDays = useMemo(() => {
    if (showPastMonths) {
      return daysWithEvents;
    }
    
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    const filtered = daysWithEvents.filter(day => {
      const dayDate = parseLocalDate(day.date);
      const dayYear = dayDate.getFullYear();
      const dayMonth = dayDate.getMonth();
      
      // Show if year is in the future
      if (dayYear > todayYear) return true;
      // Hide if year is in the past
      if (dayYear < todayYear) return false;
      // Same year: show if month >= current month
      return dayMonth >= todayMonth;
    });
    
    return filtered;
  }, [daysWithEvents, showPastMonths, parseLocalDate]);

  // Group days by month for rendering (handles cross-year ranges)
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; monthIndex: number; year: number; days: DayData[] }[] = [];
    let currentKey = '';
    let currentGroup: DayData[] = [];
    
    visibleDays.forEach(day => {
      const dayDate = parseLocalDate(day.date);
      const dayYear = dayDate.getFullYear();
      const dayMonth = dayDate.getMonth();
      const key = `${dayYear}-${dayMonth}`;
      
      if (key !== currentKey) {
        if (currentGroup.length > 0) {
          const firstDay = currentGroup[0];
          const firstDayDate = parseLocalDate(firstDay.date);
          const isLookAhead = firstDayDate.getFullYear() !== selectedYear;
          const displayName = isLookAhead 
            ? `${firstDay.monthName} ${firstDayDate.getFullYear()}`
            : firstDay.monthName;
          
          groups.push({
            monthName: displayName,
            monthIndex: firstDayDate.getMonth(),
            year: firstDayDate.getFullYear(),
            days: currentGroup,
          });
        }
        currentKey = key;
        currentGroup = [day];
      } else {
        currentGroup.push(day);
      }
    });
    
    if (currentGroup.length > 0) {
      const firstDay = currentGroup[0];
      const firstDayDate = parseLocalDate(firstDay.date);
      const isLookAhead = firstDayDate.getFullYear() !== selectedYear;
      const displayName = isLookAhead 
        ? `${firstDay.monthName} ${firstDayDate.getFullYear()}`
        : firstDay.monthName;
      
      groups.push({
        monthName: displayName,
        monthIndex: firstDayDate.getMonth(),
        year: firstDayDate.getFullYear(),
        days: currentGroup,
      });
    }
    
    return groups;
  }, [visibleDays, selectedYear]);

  // Month labels for the index (based on visible months)
  const monthLabels = useMemo(() => {
    const labels: { index: number; year: number; label: string; fullName: string }[] = [];
    const seen = new Set<string>();
    
    monthGroups.forEach(group => {
      const key = `${group.year}-${group.monthIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        const date = new Date(group.year, group.monthIndex, 1);
        labels.push({
          index: group.monthIndex,
          year: group.year,
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          fullName: `${date.toLocaleDateString('en-US', { month: 'long' })} ${group.year}`,
        });
      }
    });
    
    return labels;
  }, [monthGroups]);

  // Load events for the date range
  useEffect(() => {
    if (!isVisible) return;
    
    const loadEvents = async () => {
      try {
        setIsLoading(true);
        // Fetch events for all years in the range
        const yearsToFetch = [];
        for (let y = startYear; y <= endYear; y++) {
          yearsToFetch.push(y);
        }
        
        // Fetch all years in parallel
        const results = await Promise.all(
          yearsToFetch.map(y => apiClient.fetchCalendarEventsForYear(y))
        );
        
        // Flatten results
        const allEvents = results.flat();
        
        setEvents(allEvents);
      } catch (error) {
        console.error('Failed to load calendar events:', error);
        toast.error('Failed to load calendar events');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEvents();
  }, [startYear, endYear, isVisible]);

  const scrollToMonth = (monthIndex: number, year: number) => {
    const targetId = `month-${year}-${monthIndex}`;
    const element = document.getElementById(targetId);
    
    if (element) {
      const monthKey = `${year}-${monthIndex}`;
      const isExpanded = expandedMonths.has(monthKey);
      
      // If collapsed, expand it first
      if (!isExpanded) {
        setExpandedMonths(prev => new Set([...prev, monthKey]));
        
        // Wait for DOM to fully update with requestAnimationFrame + longer delay
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Use instant behavior after expansion for reliable positioning
            element.scrollIntoView({ behavior: 'instant', block: 'start' });
          }, 300); // Longer delay to ensure all day rows are rendered
        });
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setShowStats(false); // Close stats when selecting a day
    setIsCreating(false);
    setEditingEvent(null);
  };

  const handleCloseDetail = useCallback(() => {
    setSelectedDate(null);
    setIsCreating(false);
    setEditingEvent(null);
    setDragEndDate(null); // Clear drag selection
    setConfirmedRangeStart(null); // Clear visual highlighting
    setConfirmedRangeEnd(null);
  }, []);

  const handleTogglePTO = useCallback(async (startDate: string, endDate: string, currentlyHasPTO: boolean) => {
    if (currentlyHasPTO) {
      // Remove PTO - find and delete PTO events in this range
      const ptoEvents = events.filter(e => e.is_pto && e.start_date >= startDate && e.end_date <= endDate);
      if (ptoEvents.length > 0) {
        try {
          // Optimistically remove from UI
          setEvents(prev => prev.filter(e => !ptoEvents.some(pto => pto.id === e.id)));
          // Delete from DB
          await Promise.all(ptoEvents.map(e => apiClient.deleteCalendarEvent(e.id)));
          toast.success('Removed PTO');
        } catch (error) {
          console.error('Failed to remove PTO:', error);
          // Restore on error
          setEvents(prev => [...prev, ...ptoEvents]);
          toast.error('Failed to remove PTO');
        }
      }
    } else {
      // Add PTO - create a PTO event for the date range
      try {
        const ptoInput: CalendarEventInput = {
          title: 'Out of Office',
          category: null,
          notes: null,
          start_date: startDate,
          end_date: endDate,
          start_time: null,
          end_time: null,
          all_day: true,
          affects_row_appearance: false,
          priority: 10,
          is_pto: true,
          source_pattern_id: null,
        };
        const newId = await apiClient.createCalendarEvent(ptoInput);
        const newEvent: CalendarEvent = {
          id: newId,
          ...ptoInput,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setEvents(prev => [...prev, newEvent]);
        const dayCount = Math.ceil((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        toast.success(dayCount > 1 ? `Marked ${dayCount} days as PTO` : 'Marked as PTO');
      } catch (error) {
        console.error('Failed to toggle PTO:', error);
        toast.error('Failed to update PTO');
      }
    }
  }, [events, parseLocalDate]);

  const handleSetLocation = useCallback(async (startDate: string, endDate: string, location: string) => {
    try {
      // Step 1: Find ALL location events that overlap with the selected range
      const overlappingLocationEvents = events.filter(e => 
        e.category === 'location' && 
        e.start_date <= endDate && 
        e.end_date >= startDate
      );

      // Step 2: Remove location from the selected date range
      // We need to clear any existing locations in this range first
      if (overlappingLocationEvents.length > 0) {
        for (const event of overlappingLocationEvents) {
          // Calculate which days to remove from this event
          const rangeStart = new Date(startDate + 'T00:00:00');
          const rangeEnd = new Date(endDate + 'T00:00:00');

          // Event is completely within selection - delete it
          if (event.start_date >= startDate && event.end_date <= endDate) {
            await apiClient.deleteCalendarEvent(event.id);
            setEvents(prev => prev.filter(e => e.id !== event.id));
            continue;
          }

          // Event starts before and ends after - split into two
          if (event.start_date < startDate && event.end_date > endDate) {
            // Keep the "before" part
            const beforeEnd = new Date(rangeStart);
            beforeEnd.setDate(beforeEnd.getDate() - 1);
            const beforeEndDate = beforeEnd.toISOString().split('T')[0];

            await apiClient.updateCalendarEvent(event.id, {
              end_date: beforeEndDate
            });

            // Create the "after" part
            const afterStart = new Date(rangeEnd);
            afterStart.setDate(afterStart.getDate() + 1);
            const afterStartDate = afterStart.toISOString().split('T')[0];

            const afterInput: CalendarEventInput = {
              title: event.title,
              category: 'location',
              notes: null,
              start_date: afterStartDate,
              end_date: event.end_date,
              start_time: null,
              end_time: null,
              all_day: true,
              affects_row_appearance: false,
              priority: 9,
              is_pto: false,
              source_pattern_id: null,
            };

            const afterId = await apiClient.createCalendarEvent(afterInput);
            const afterEvent: CalendarEvent = {
              id: afterId,
              ...afterInput,
              user_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            setEvents(prev => [
              ...prev.map(e => 
                e.id === event.id 
                  ? { ...e, end_date: beforeEndDate }
                  : e
              ),
              afterEvent
            ]);
            continue;
          }

          // Event starts before selection - trim the end
          if (event.start_date < startDate && event.end_date <= endDate) {
            const newEnd = new Date(rangeStart);
            newEnd.setDate(newEnd.getDate() - 1);
            const newEndDate = newEnd.toISOString().split('T')[0];

            await apiClient.updateCalendarEvent(event.id, {
              end_date: newEndDate
            });

            setEvents(prev => prev.map(e => 
              e.id === event.id 
                ? { ...e, end_date: newEndDate }
                : e
            ));
            continue;
          }

          // Event ends after selection - trim the start
          if (event.start_date >= startDate && event.end_date > endDate) {
            const newStart = new Date(rangeEnd);
            newStart.setDate(newStart.getDate() + 1);
            const newStartDate = newStart.toISOString().split('T')[0];

            await apiClient.updateCalendarEvent(event.id, {
              start_date: newStartDate
            });

            setEvents(prev => prev.map(e => 
              e.id === event.id 
                ? { ...e, start_date: newStartDate }
                : e
            ));
            continue;
          }
        }
      }

      // Step 3: If location is provided, create new location event for the range
      if (location && location.trim()) {
        const locationInput: CalendarEventInput = {
          title: location.trim(),
          category: 'location',
          notes: null,
          start_date: startDate,
          end_date: endDate,
          start_time: null,
          end_time: null,
          all_day: true,
          affects_row_appearance: false,
          priority: 9,
          is_pto: false,
          source_pattern_id: null,
        };

        const newId = await apiClient.createCalendarEvent(locationInput);
        const newEvent: CalendarEvent = {
          id: newId,
          ...locationInput,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setEvents(prev => [...prev, newEvent]);
        const dayCount = Math.ceil((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        toast.success(dayCount > 1 ? `Location set for ${dayCount} days` : 'Location set');
      } else if (overlappingLocationEvents.length > 0) {
        toast.success('Location removed');
      }

    } catch (error) {
      console.error('Failed to update location:', error);
      toast.error('Failed to update location');
    }
  }, [events, parseLocalDate]);

  const handleCreateEvent = useCallback(() => {
    setIsCreating(true);
    setEditingEvent(null);
  }, []);

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setIsCreating(false);
  }, []);

  const handleViewEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventModal = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleSaveEvent = async (input: CalendarEventInput, eventId?: string) => {
    try {
      if (eventId) {
        // Update existing
        await apiClient.updateCalendarEvent(eventId, input);
        // Merge updates into existing event
        setEvents(prev => prev.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              ...input,
              updated_at: new Date().toISOString(),
            };
          }
          return e;
        }));
        toast.success('Event updated');
      } else {
        // Create new
        const newId = await apiClient.createCalendarEvent(input);
        const newEvent: CalendarEvent = {
          id: newId,
          title: input.title,
          category: input.category,
          notes: input.notes,
          start_date: input.start_date,
          end_date: input.end_date,
          start_time: input.start_time,
          end_time: input.end_time,
          all_day: input.all_day,
          affects_row_appearance: input.affects_row_appearance,
          priority: input.priority,
          is_pto: input.is_pto,
          source_pattern_id: input.source_pattern_id,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setEvents(prev => [...prev, newEvent]);
        toast.success('Event created');
      }
      
      setIsCreating(false);
      setEditingEvent(null);
      setDragEndDate(null); // Clear drag selection after save
      setConfirmedRangeStart(null); // Clear visual highlighting
      setConfirmedRangeEnd(null);
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Failed to save event');
    }
  };

  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTimeoutId, setDeleteTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Remove PTO/Location from a specific day (handles multi-day ranges)
  const handleRemoveDayMetadata = async (dayDate: string, metadataType: 'pto' | 'location') => {
    const targetEvent = events.find(e => 
      (metadataType === 'pto' ? e.is_pto : e.category === 'location') &&
      e.start_date <= dayDate && 
      e.end_date >= dayDate
    );
    
    if (!targetEvent) return;
    
    // Single day event - just delete it
    if (targetEvent.start_date === targetEvent.end_date) {
      handleDeleteEvent(targetEvent.id);
      return;
    }
    
    // Multi-day event - need to adjust range or split
    try {
      const isFirstDay = dayDate === targetEvent.start_date;
      const isLastDay = dayDate === targetEvent.end_date;
      
      if (isFirstDay) {
        // Remove first day - move start date forward
        const nextDay = new Date(dayDate + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const newStartDate = nextDay.toISOString().split('T')[0];
        
        await apiClient.updateCalendarEvent(targetEvent.id, {
          start_date: newStartDate
        });
        
        setEvents(prev => prev.map(e => 
          e.id === targetEvent.id 
            ? { ...e, start_date: newStartDate }
            : e
        ));
        toast.success(`Removed ${metadataType === 'pto' ? 'PTO' : 'location'} from ${dayDate}`);
        
      } else if (isLastDay) {
        // Remove last day - move end date backward
        const prevDay = new Date(dayDate + 'T00:00:00');
        prevDay.setDate(prevDay.getDate() - 1);
        const newEndDate = prevDay.toISOString().split('T')[0];
        
        await apiClient.updateCalendarEvent(targetEvent.id, {
          end_date: newEndDate
        });
        
        setEvents(prev => prev.map(e => 
          e.id === targetEvent.id 
            ? { ...e, end_date: newEndDate }
            : e
        ));
        toast.success(`Removed ${metadataType === 'pto' ? 'PTO' : 'location'} from ${dayDate}`);
        
      } else {
        // Remove middle day - need to split into two events
        const beforeDay = new Date(dayDate + 'T00:00:00');
        beforeDay.setDate(beforeDay.getDate() - 1);
        const beforeEndDate = beforeDay.toISOString().split('T')[0];
        
        const afterDay = new Date(dayDate + 'T00:00:00');
        afterDay.setDate(afterDay.getDate() + 1);
        const afterStartDate = afterDay.toISOString().split('T')[0];
        
        // Update existing event to end before the removed day
        await apiClient.updateCalendarEvent(targetEvent.id, {
          end_date: beforeEndDate
        });
        
        // Create new event for days after the removed day
        const secondHalfInput: CalendarEventInput = {
          title: targetEvent.title,
          category: targetEvent.category,
          notes: targetEvent.notes,
          start_date: afterStartDate,
          end_date: targetEvent.end_date,
          start_time: targetEvent.start_time,
          end_time: targetEvent.end_time,
          all_day: targetEvent.all_day,
          affects_row_appearance: targetEvent.affects_row_appearance,
          priority: targetEvent.priority,
          is_pto: targetEvent.is_pto,
          source_pattern_id: targetEvent.source_pattern_id,
        };
        
        const newId = await apiClient.createCalendarEvent(secondHalfInput);
        const newEvent: CalendarEvent = {
          id: newId,
          ...secondHalfInput,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setEvents(prev => [
          ...prev.map(e => 
            e.id === targetEvent.id 
              ? { ...e, end_date: beforeEndDate }
              : e
          ),
          newEvent
        ]);
        
        toast.success(`Removed ${metadataType === 'pto' ? 'PTO' : 'location'} from ${dayDate}`);
      }
    } catch (error) {
      console.error(`Failed to remove ${metadataType}:`, error);
      toast.error(`Failed to remove ${metadataType}`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;
    
    // Optimistically remove from UI
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setDeletingEvent(eventToDelete);
    setEditingEvent(null);
    
    // Show undo toast
    toast.success('Event deleted', {
      ttlMs: 8000,
      actionLabel: 'Undo',
      onAction: handleUndoDelete
    });
    
    // Set timeout to actually delete from DB after 8 seconds
    const timeoutId = setTimeout(async () => {
      try {
        await apiClient.deleteCalendarEvent(eventId);
        setDeletingEvent(null);
        // Toast already shown
      } catch (error) {
        console.error('Failed to delete event:', error);
        // Restore event if DB delete failed
        setEvents(prev => [...prev, eventToDelete]);
        toast.error('Failed to delete event');
      }
    }, 8000);
    
    setDeleteTimeoutId(timeoutId);
  };

  const handleUndoDelete = () => {
    if (!deletingEvent) return;
    
    // Cancel the delete timeout
    if (deleteTimeoutId) {
      clearTimeout(deleteTimeoutId);
      setDeleteTimeoutId(null);
    }
    
    // Restore event to UI
    setEvents(prev => [...prev, deletingEvent]);
    setDeletingEvent(null);
    
    toast.success('Deletion undone');
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutId) {
        clearTimeout(deleteTimeoutId);
      }
    };
  }, [deleteTimeoutId]);

  // Global mouseup handler for drag selection
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        handleDragEnd();
      };
      
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, dragStartDate, dragEndDate]);

  // Cleanup long press timer on unmount or when cancelled
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  // Close NL panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nlPanelRef.current && !nlPanelRef.current.contains(event.target as Node)) {
        // Check if click is on the header input (allow it)
        if (nlInputRef.current && nlInputRef.current.contains(event.target as Node)) {
          return;
        }
        setShowNlPanel(false);
      }
    };

    if (showNlPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNlPanel]);

  // Auto-focus NL input in bottom sheet when opened
  useEffect(() => {
    if (showNlSheet && nlSheetInputRef.current) {
      setTimeout(() => nlSheetInputRef.current?.focus(), 100);
    }
  }, [showNlSheet]);

  // Track year header visibility with scroll position
  useEffect(() => {
    if (!isVisible) return;
    
    const setupScrollTracking = () => {
      // If refs aren't ready, try again
      if (!topRef.current || !scrollContainerRef.current) {
        return false;
      }
      
      // Find the scrollable parent container
      let container: HTMLElement | null = null;
      let element: HTMLElement | null = scrollContainerRef.current;
      
      while (element) {
        const styles = window.getComputedStyle(element);
        if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
          container = element;
          break;
        }
        element = element.parentElement;
      }

      if (!container) {
        return true; // Don't retry if we can't find container
      }

      const handleScroll = () => {
        if (!topRef.current || !container) return;
        
        // Get the header's position relative to the scroll container
        const headerRect = topRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Header is visible if its bottom is below the container's top
        const headerVisible = headerRect.bottom > containerRect.top;
        
        setIsYearHeaderVisible(headerVisible);
      };
      
      // Initial check
      handleScroll();

      container.addEventListener('scroll', handleScroll);
      
      // Cleanup function
      return () => {
        container?.removeEventListener('scroll', handleScroll);
      };
    };

    // Try to setup immediately
    let cleanup = setupScrollTracking();
    
    // If it didn't work, retry a few times
    let attempts = 0;
    const maxAttempts = 5;
    const retryInterval = setInterval(() => {
      if (cleanup || attempts >= maxAttempts) {
        clearInterval(retryInterval);
        return;
      }
      
      attempts++;
      cleanup = setupScrollTracking();
    }, 100);

    return () => {
      clearInterval(retryInterval);
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [isVisible]);

  // Handle NL input submission
  const handleNlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim()) return;
    
    try {
      // Parse input to event
      const parsedEvent = await apiClient.parseNaturalLanguageEvent(nlInput);
      
      // Create the event in Supabase
      const newId = await apiClient.createCalendarEvent(parsedEvent);
      
      // Add to local state
      const newEvent: CalendarEvent = {
        id: newId,
        ...parsedEvent,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEvents(prev => [...prev, newEvent]);
      
      // Success!
      toast.success(`Created: ${parsedEvent.title}`);
      setNlInput('');
      setShowNlPanel(false);
    } catch (error: any) {
      console.error('Failed to create event from NL:', error);
      toast.error(error.message || 'Could not understand event. Try manual entry.');
    }
  };

  // Unified scroll detection for both scroll-to-top button and month index
  useEffect(() => {
    if (!isVisible) return;
    
    // Wait for ref to be set
    if (!scrollContainerRef.current) {
      const timer = setTimeout(() => {}, 100);
      return () => clearTimeout(timer);
    }
    
    // Find scrollable container by traversing up (same as handleScrollToTop)
    let container: HTMLElement | null = null;
    let element: HTMLElement | null = scrollContainerRef.current;
    
    while (element) {
      const styles = window.getComputedStyle(element);
      if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
        container = element;
        break;
      }
      element = element.parentElement;
    }

    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container!.scrollTop;
      const isScrolled = scrollTop > 100;
      
      // Show/hide scroll-to-top button
      setShowScrollTop(isScrolled);
      
      // Show month index on scroll, hide after 2s of inactivity
      if (isScrolled) {
        setShowMonthIndex(true);
        
        // Clear existing timeout
        if (monthIndexTimeoutRef.current) {
          clearTimeout(monthIndexTimeoutRef.current);
        }
        
        // Hide after 2 seconds of no scrolling
        monthIndexTimeoutRef.current = setTimeout(() => {
          setShowMonthIndex(false);
        }, 2000);
      } else {
        // At top - hide month index
        setShowMonthIndex(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    
    return () => {
      container?.removeEventListener('scroll', handleScroll);
      if (monthIndexTimeoutRef.current) {
        clearTimeout(monthIndexTimeoutRef.current);
      }
    };
  }, [isVisible, scrollContainerRef.current]);


  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return daysWithEvents.find(d => d.date === selectedDate);
  }, [selectedDate, daysWithEvents]);

  const handleScrollToTop = () => {
    // Find the scrollable container (div with overflow-y-auto that contains TopBanner + main)
    let scrollContainer: HTMLElement | null = null;
    
    // Start from our component and go up to find the overflow-y-auto div
    let element: HTMLElement | null = scrollContainerRef.current;
    while (element) {
      const styles = window.getComputedStyle(element);
      if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
        scrollContainer = element;
        break;
      }
      element = element.parentElement;
    }
    
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Multi-day drag selection handlers
  const handleDragStart = (date: string, e: React.MouseEvent) => {
    // Only allow drag on the day box itself, not on events
    if ((e.target as HTMLElement).closest('.group\\/event')) {
      return;
    }
    setIsDragging(true);
    setDragStartDate(date);
    setDragEndDate(date);
    setConfirmedRangeStart(null); // Clear previous selection
    setConfirmedRangeEnd(null);
  };

  const handleDragOver = (date: string) => {
    if (isDragging && dragStartDate) {
      setDragEndDate(date);
    }
  };

  const handleDragEnd = () => {
    if (isDragging && dragStartDate && dragEndDate) {
      // Determine the actual start and end dates (user might drag backwards)
      const start = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
      const end = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;
      
      // Only create multi-day event if more than one day selected
      if (start !== end) {
        setSelectedDate(start);
        setDragEndDate(end); // Set the calculated end date
        setConfirmedRangeStart(start); // Keep visual highlighting
        setConfirmedRangeEnd(end);
        setIsCreating(true);
        setEditingEvent(null);
        setIsDragging(false);
        setDragStartDate(null);
        return; // Keep dragEndDate for the form
      } else {
        // Single day click - normal behavior
        handleDayClick(dragStartDate);
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

  // Get the selected date range for visual feedback
  const getSelectedRange = (): string[] => {
    // While dragging, show the dragging range
    if (isDragging && dragStartDate && dragEndDate) {
      const start = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
      const end = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;
      
      const range: string[] = [];
      const currentDate = parseLocalDate(start);
      const endDateObj = parseLocalDate(end);
      
      while (currentDate <= endDateObj) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        range.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return range;
    }
    
    // After drag ends, show the confirmed range
    if (confirmedRangeStart && confirmedRangeEnd) {
      const range: string[] = [];
      const currentDate = parseLocalDate(confirmedRangeStart);
      const endDateObj = parseLocalDate(confirmedRangeEnd);
      
      while (currentDate <= endDateObj) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        range.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return range;
    }
    
    return [];
  };

  const selectedRange = getSelectedRange();

  // Today's date for highlighting
  const today = new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <div className={cn(tokens.layout.container, 'py-8')}>
        <div className="text-center text-neutral-400">Loading calendar...</div>
      </div>
    );
  }

  // Early return AFTER all hooks to prevent unnecessary rendering
  if (!isVisible) {
    return <div className="hidden" />;
  }

  return (
    <div ref={scrollContainerRef}>
      {/* Desktop layout: main list + right pane */}
      <div className="flex gap-4">
        {/* Main calendar list */}
        <div className={cn(
          'flex-1',
          selectedDate ? 'lg:w-2/3' : 'w-full'
        )}>
          {/* Header controls */}
          <div 
            ref={topRef} 
            className="pt-4 pb-6 border-b border-neutral-800"
          >
            {isPending && (
              <div className="absolute top-2 right-2 text-xs text-emerald-400 animate-pulse">
                Loading...
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Year selector - dropdown only, shows current ± 2 years */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => startTransition(() => setSelectedYear(Number(e.target.value)))}
                  className="text-xl font-semibold text-neutral-100 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors disabled:opacity-50"
                  disabled={isPending}
                >
                  {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(year => (
                    <option key={year} value={year} className="bg-neutral-900">
                      {year}
                    </option>
                  ))}
                </select>
                {selectedYear !== currentYear && (
                  <button
                    onClick={() => startTransition(() => setSelectedYear(currentYear))}
                    className={cn(tokens.button.secondary, 'text-xs px-2 py-1 ml-2')}
                    disabled={isPending}
                  >
                    Today
                  </button>
                )}
              </div>
              
              {/* Quick Add Input - Hidden on mobile */}
              <div className="hidden md:flex flex-1 max-w-2xl mx-4">
                <form onSubmit={handleNlSubmit} className="w-full relative">
                  <div className="relative">
                    <input
                      ref={nlInputRef}
                      type="text"
                      value={nlInput}
                      onChange={(e) => setNlInput(e.target.value)}
                      onFocus={() => setShowNlPanel(true)}
                      placeholder={placeholderText}
                      className="w-full px-4 py-2 pl-10 pr-10 bg-neutral-900 border border-neutral-700 rounded-full text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                    {nlInput.trim() && (
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Create event"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Mobile: Quick Add button - Shows on mobile */}
              <button
                onClick={() => setShowNlSheet(true)}
                className={cn(
                  'md:hidden',
                  tokens.button.ghost,
                  'p-2 text-emerald-400'
                )}
                title="Add event"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              
              {/* Right controls group */}
              <div className="flex items-center">
                {/* Stats button */}
                <button
                  onClick={() => setShowStats(!showStats)}
                  className={cn(tokens.button.ghost, 'p-2', showStats && 'bg-neutral-800')}
                  title="View stats"
                >
                  <BarChart3 className="w-5 h-5" />
              </button>
              
              {/* Settings button */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(tokens.button.ghost, 'p-2')}
                  title="Calendar settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                
                {/* Settings dropdown */}
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-4 z-40">
                    <h3 className="text-sm font-semibold text-neutral-100 mb-3">Calendar Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={showPastMonths}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setShowPastMonths(newValue);
                            try {
                              localStorage.setItem('calendar-show-past-months', String(newValue));
                            } catch {}
                          }}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400"
                        />
                        <span>Show past months</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={snapToToday}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setSnapToToday(newValue);
                            try {
                              localStorage.setItem('calendar-snap-to-today', String(newValue));
                            } catch {}
                            // Note: Don't scroll immediately when toggling - only on reload
                          }}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400"
                        />
                        <span>Scroll to today on load</span>
                      </label>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Desktop: Expanded NL Panel - Just examples */}
            {showNlPanel && (
              <div 
                ref={nlPanelRef}
                className="hidden md:block mt-4 bg-neutral-900/95 border border-neutral-700 rounded-xl p-4 shadow-2xl backdrop-blur-sm"
              >
                <div className="text-xs text-neutral-400 space-y-1">
                  <p className="flex items-center gap-1.5 text-neutral-300 font-medium">
                    💡 Examples:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>"PTO Dec 22 to Jan 2" → Creates golden PTO days</li>
                    <li>"Bahamas travel next week" → Creates travel event</li>
                    <li>"Doctor appointment tomorrow 3pm" → Creates timed event</li>
                  </ul>
                          </div>
              </div>
            )}
          </div>

          {/* Day rows/grid grouped by month */}
          <div className="pb-24">
            {monthGroups.map((group, idx) => {
              const monthKey = `${group.year}-${String(group.monthIndex).padStart(2, '0')}`;
              const isExpanded = expandedMonths.has(monthKey);
              
              return (
              <div 
                key={`${group.year}-${group.monthIndex}-${group.days[0]?.date || idx}`} 
                id={`month-${group.year}-${group.monthIndex}`} 
                className={isExpanded && idx > 0 ? 'mt-4' : ''}
                style={{ scrollMarginTop: '80px' }} // Space for sticky header
              >
                {/* Month header - Clickable, sticky only when expanded */}
                <div 
                  className={cn(
                    'bg-neutral-950 -mx-6 px-6',
                    isExpanded ? 'pt-4 pb-3 mb-2 sticky top-0 z-10' : 'pt-1 pb-1'
                  )}
                >
                  <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      {/* Month name - clickable area */}
                      <button
                        onClick={() => toggleMonth(group.year, group.monthIndex)}
                        className="flex-1 text-left"
                      >
                        <h2 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                          {group.monthName}
                        </h2>
                      </button>
                      
                      {/* Add button - shown when year header is not visible AND month is expanded (sticky) */}
                      {!isYearHeaderVisible && isExpanded && (
                        <button
                          onClick={() => {
                            setActiveMonthDropdown(activeMonthDropdown === monthKey ? null : monthKey);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/30 rounded-full text-xs font-medium text-emerald-300 transition-colors flex-shrink-0"
                          title="Add event"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                      )}
                      
                      {/* Collapse/expand chevron - clickable */}
                      <button
                        onClick={() => toggleMonth(group.year, group.monthIndex)}
                        className="flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dropdown Module - appears below sticky month header - Simple NL only */}
                {activeMonthDropdown === monthKey && isExpanded && (
                  <div className="bg-neutral-900/98 border border-neutral-700 rounded-xl p-5 mx-4 mb-3 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-semibold text-neutral-100">Add to {group.monthName}</h4>
                      <button
                        onClick={() => setActiveMonthDropdown(null)}
                        className="p-1 hover:bg-neutral-800 rounded transition-colors"
                      >
                        <X className="w-5 h-5 text-neutral-400" />
                      </button>
                    </div>

                      <div>
                        <div className="relative">
                          <input
                            type="text"
                          placeholder="Type anything: 'Dentist 2pm' or 'PTO this week' or 'Trip to NYC'"
                            className="w-full px-4 py-2.5 pl-10 pr-4 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                const nlText = e.currentTarget.value;
                                try {
                                  const parsedEvent = await apiClient.parseNaturalLanguageEvent(nlText);
                                  const newId = await apiClient.createCalendarEvent(parsedEvent);
                                  const newEvent: CalendarEvent = {
                                    id: newId,
                                    ...parsedEvent,
                                    user_id: null,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  };
                                  setEvents(prev => [...prev, newEvent]);
                                  toast.success(`Created: ${parsedEvent.title}`);
                                  setActiveMonthDropdown(null);
                                } catch (error: any) {
                                  console.error('Failed to create event:', error);
                                  toast.error(error.message || 'Could not parse event');
                                }
                              }
                            }}
                            autoFocus
                          />
                          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                        </div>
                      <p className="text-xs text-neutral-500 mt-2">Press Enter to create</p>
                      </div>
                      </div>
                )}

                {/* Day rows/grid - only render if expanded */}
                {isExpanded && (
                  <>
                    {/* Mobile: Row layout (default, < md) */}
                    <div className="md:hidden space-y-1" style={{ containIntrinsicSize: 'auto 80px' }}>
                    {group.days.map(day => {
                    const isSelected = selectedDate === day.date;
                      const hasEvents = day.events.filter(e => !e.is_pto && e.category !== 'location').length > 0; // Exclude PTO and location from event count
                    const isToday = day.date === today;
                    const rowAppearance = getRowAppearance(day);
                    const isInDragRange = selectedRange.includes(day.date);
                    
                    return (
                      <div
                        key={day.date}
                        className="group/day relative"
                        style={{ 
                          contentVisibility: 'auto',
                        }}
                      >
                        <button
                          ref={isToday ? todayRef : undefined}
                          data-date={day.date}
                          onClick={() => !isDragging && handleDayClick(day.date)}
                          onTouchStart={(e) => handleTouchStart(day.date, e)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                            'hover:bg-neutral-800/50',
                            isInDragRange && 'bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500/50',
                            !isInDragRange && isSelected && 'bg-neutral-800 border-emerald-500',
                            !isInDragRange && !isSelected && rowAppearance.bg,
                            !isInDragRange && !isSelected && rowAppearance.border,
                            isToday && !isSelected && !isInDragRange && 'ring-2 ring-emerald-400/50',
                            isDragging && 'select-none',
                          )}
                          style={{ 
                            scrollMarginTop: isToday ? '200px' : undefined // Space for 2-3 days above + sticky header
                          }}
                        >
                        {/* Mobile compact layout: Date left | Facets right */}
                        <div className="flex gap-3">
                          {/* Left: Date info - fixed column widths for alignment */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Column 1: Day name - fixed width */}
                            <span className={cn(
                              'text-sm font-medium w-9',
                              day.isWeekend ? 'text-emerald-400' : 'text-neutral-400'
                            )}>
                              {day.dayOfWeek}
                            </span>
                            {/* Column 2: PTO dot space - fixed width, centered */}
                            <div className="w-2.5 flex items-center justify-center flex-shrink-0">
                              {rowAppearance.hasPto && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDayMetadata(day.date, 'pto');
                                  }}
                                  className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-300 shadow-sm hover:bg-yellow-500 transition-colors cursor-pointer"
                                  title="Out of Office (PTO) - Click to remove"
                                />
                              )}
                            </div>
                            {/* Column 3: Day number - fixed width */}
                            <span className={cn(
                              'text-lg font-semibold w-8',
                              day.isWeekend ? 'text-emerald-300' : 'text-neutral-100'
                            )}>
                              {day.dayNumber}
                            </span>
                          </div>
                          
                          {/* Right: Facets column - location first, then events */}
                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Location facet - first */}
                            {day.events.some(e => e.category === 'location') && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-950/30 border border-blue-700/30 rounded text-xs text-blue-300 hover:bg-blue-950/40 transition-colors">
                                <span className="truncate">📍 {day.events.find(e => e.category === 'location')?.title}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDayMetadata(day.date, 'location');
                                  }}
                                  className="flex-shrink-0 text-blue-400 hover:text-blue-200 hover:bg-blue-900/50 rounded p-0.5 transition-colors"
                                  title="Remove location"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            
                            {/* Event facets - below location */}
                            {hasEvents && (
                              <div className="flex flex-wrap gap-2">
                                  {day.events
                                    .filter(event => !event.is_pto && event.category !== 'location')
                                    .slice(0, 3)
                                    .map(event => {
                                const style = getCategoryStyle(event.category);
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border cursor-pointer',
                                      'hover:bg-neutral-700/50 transition-all',
                                      style.bg,
                                      style.border
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleViewEvent(event);
                                    }}
                                  >
                                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
                                    <span className={cn('truncate max-w-[100px]', style.text)}>{event.title}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEvent(event.id);
                                      }}
                                      className="text-neutral-400 opacity-70 group-hover:opacity-100 hover:text-rose-400 transition-all ml-0.5"
                                      title="Delete event"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                                  {day.events.filter(e => !e.is_pto && e.category !== 'location').length > 3 && (
                                  <span className="text-xs text-neutral-400">
                                      +{day.events.filter(e => !e.is_pto && e.category !== 'location').length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        </button>
                        
                        {/* Quick Add Button (shows on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setIsCreating(true);
                            setEditingEvent(null);
                          }}
                          className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2',
                            'opacity-0 group-hover/day:opacity-100',
                            'p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full',
                            'transition-all shadow-lg hover:scale-110',
                            'z-10'
                          )}
                          title="Quick add event"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  </div>

                    {/* Desktop: Grid layout (>= md) */}
                    <div className="hidden md:grid grid-cols-8 gap-2" style={{ gridAutoRows: '1fr', containIntrinsicSize: 'auto 150px' }}>
                      {group.days.map((day) => {
                      const isSelected = selectedDate === day.date;
                      const isToday = day.date === today;
                      const rowAppearance = getRowAppearance(day);
                      const isInDragRange = selectedRange.includes(day.date);
                      
                      return (
                        <div
                          key={day.date}
                          className="group/day relative flex"
                          style={{ 
                            contentVisibility: 'auto',
                          }}
                        >
                          <button
                            ref={isToday ? todayRef : undefined}
                            onMouseDown={(e) => handleDragStart(day.date, e)}
                            onMouseEnter={() => handleDragOver(day.date)}
                            onClick={() => !isDragging && handleDayClick(day.date)}
                            className={cn(
                              'w-full h-full min-h-[120px] text-left p-3 rounded-lg border transition-colors',
                              'flex flex-col',
                              'hover:bg-neutral-800/50',
                              isInDragRange && 'bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500/50',
                              !isInDragRange && isSelected && 'bg-neutral-800 border-emerald-500 ring-2 ring-emerald-500/30',
                              !isInDragRange && !isSelected && rowAppearance.bg,
                              !isInDragRange && !isSelected && rowAppearance.border,
                              isToday && !isSelected && !isInDragRange && 'ring-2 ring-emerald-400/50',
                              isDragging && 'select-none',
                            )}
                            style={{ 
                              scrollMarginTop: isToday ? '200px' : undefined
                            }}
                          >
                            {/* Header: Day of week + number */}
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-700/50">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'text-xs font-medium uppercase',
                                  day.isWeekend ? 'text-emerald-400' : 'text-neutral-500'
                                )}>
                                  {day.dayOfWeek}
                                </span>
                                {/* Gold PTO indicator dot - Click to remove */}
                                {rowAppearance.hasPto && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveDayMetadata(day.date, 'pto');
                                    }}
                                    className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-300 shadow-sm hover:bg-yellow-500 transition-colors cursor-pointer"
                                    title="Out of Office (PTO) - Click to remove"
                                  />
                                )}
                                {/* Location indicator - Click to remove */}
                                {day.events.some(e => e.category === 'location') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveDayMetadata(day.date, 'location');
                                    }}
                                    className="text-xs hover:scale-110 transition-transform cursor-pointer"
                                    title={`📍 ${day.events.find(e => e.category === 'location')?.title} - Click to remove`}
                                  >
                                    📍
                                  </button>
                                )}
                              </div>
                              <span className={cn(
                                'text-2xl font-bold',
                                day.isWeekend ? 'text-emerald-300' : 'text-neutral-100'
                              )}>
                                {day.dayNumber}
                              </span>
                            </div>
                            
                            {/* Location display */}
                            {day.events.some(e => e.category === 'location') && (
                              <div className="group/location relative mb-2 px-2 py-1 bg-blue-950/30 border border-blue-700/30 rounded text-xs text-blue-300 truncate hover:bg-blue-950/40 transition-colors">
                                <span>📍 {day.events.find(e => e.category === 'location')?.title}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDayMetadata(day.date, 'location');
                                  }}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-blue-400 hover:text-blue-200 hover:bg-blue-900/50 rounded opacity-0 group-hover/location:opacity-100 transition-opacity"
                                  title="Remove location"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            
                            {/* Events list - vertical stack (exclude PTO and location - they're day-level metadata) */}
                            <div className="flex-1 space-y-1.5">
                              {day.events
                                .filter(event => !event.is_pto && event.category !== 'location') // PTO and location don't show as event pills
                                .map(event => {
                                const style = getCategoryStyle(event.category);
                                const borderColor = getCategoryBorderColor(event.category);
                                
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      'group/event flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer',
                                      'hover:bg-neutral-700/50 transition-all',
                                      'border-l-2',
                                      style.bg
                                    )}
                                    style={{ borderLeftColor: borderColor }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleViewEvent(event);
                                    }}
                                  >
                                    {/* Event content */}
                                    <div className={cn('flex-1 min-w-0 text-[11px] font-medium break-words leading-tight', style.text)}>
                                      {event.title}
                                    </div>
                                    {/* Delete X - on hover */}
                                    <button
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
                          
                          {/* Quick Add Button (shows on hover) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day.date);
                              setIsCreating(true);
                              setEditingEvent(null);
                            }}
                            className={cn(
                              'absolute bottom-2 left-1/2 -translate-x-1/2',
                              'opacity-0 group-hover/day:opacity-100',
                              'p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full',
                              'transition-all shadow-lg hover:scale-110',
                              'z-10'
                            )}
                            title="Quick add event"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Month index (right side) - Vertically centered with background, auto-hide */}
        <div className={cn(
          'fixed z-20 transition-opacity duration-300',
          // Mobile: right-4, bottom-20 (above scroll button)
          // Desktop: right-6, vertically centered
          'right-4 bottom-20 md:right-6 md:top-1/2 md:-translate-y-1/2 md:bottom-auto',
          showMonthIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <div className="bg-neutral-900/95 border border-neutral-700 rounded-xl p-2 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col gap-0.5 max-h-[50vh] overflow-y-auto">
              {monthLabels.map(month => (
                <button
                  key={`${month.year}-${month.index}`}
                  onClick={() => scrollToMonth(month.index, month.year)}
                  className={cn(
                    'px-2 py-1.5 text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors',
                    'text-neutral-400 hover:text-neutral-100'
                  )}
                  title={month.fullName}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: Right detail pane */}
        {selectedDate && selectedDayData && (
          <div className="hidden lg:block w-1/3 flex-shrink-0 sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-auto">
            <DayDetailPane
              dayData={selectedDayData}
              onClose={handleCloseDetail}
              isCreating={isCreating}
              editingEvent={editingEvent}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              onSaveEvent={handleSaveEvent}
              onDeleteEvent={handleDeleteEvent}
              dragEndDate={dragEndDate}
              onTogglePTO={handleTogglePTO}
              onSetLocation={handleSetLocation}
            />
          </div>
        )}

        {/* Desktop: Stats panel */}
        {showStats && !selectedDate && (
          <div className="hidden lg:block w-1/3 flex-shrink-0 sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-auto">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl">
              {/* Header */}
              <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4">
                <div className="flex items-center justify-between">
                  <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                    {selectedYear} Stats
                  </h3>
                  <button
                    onClick={() => setShowStats(false)}
                    className={cn(tokens.button.ghost, 'p-2')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-6">
                {/* PTO Count */}
                <div className="bg-yellow-950/20 border border-yellow-700/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    <h4 className="text-sm font-semibold text-yellow-300">Out of Office (PTO)</h4>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-yellow-100">
                      {(() => {
                        // Count PTO days for selected year
                        const yearStart = `${selectedYear}-01-01`;
                        const yearEnd = `${selectedYear}-12-31`;
                        const ptoDays = events.filter(e => 
                          e.is_pto && 
                          e.start_date >= yearStart && 
                          e.end_date <= yearEnd
                        );
                        
                        // Calculate total days
                        let totalDays = 0;
                        ptoDays.forEach(event => {
                          const start = new Date(event.start_date + 'T00:00:00');
                          const end = new Date(event.end_date + 'T00:00:00');
                          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          totalDays += days;
                        });
                        
                        return totalDays;
                      })()}
                    </span>
                    <span className="text-sm text-neutral-400">days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet for day details */}
      {selectedDate && selectedDayData && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" onMouseDown={(e) => e.target === e.currentTarget && handleCloseDetail()}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-h-[80vh] bg-neutral-900 rounded-t-2xl border-t border-neutral-800 overflow-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DayDetailPane
              dayData={selectedDayData}
              onClose={handleCloseDetail}
              isCreating={isCreating}
              editingEvent={editingEvent}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              onSaveEvent={handleSaveEvent}
              onDeleteEvent={handleDeleteEvent}
              dragEndDate={dragEndDate}
              onTogglePTO={handleTogglePTO}
              onSetLocation={handleSetLocation}
            />
          </div>
        </div>
      )}

      {/* Mobile: Bottom sheet for NL input */}
      {showNlSheet && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowNlSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-h-[90vh] bg-neutral-900 rounded-t-2xl border-t border-neutral-800 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
              <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Add Event
              </h3>
              <button
                onClick={() => setShowNlSheet(false)}
                className={cn(tokens.button.ghost, 'p-2')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <form onSubmit={handleNlSubmit} className="space-y-3">
                {/* NL Input */}
                <div className="relative">
                  <input
                    ref={nlSheetInputRef}
                    type="text"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    placeholder={placeholderText}
                    className="w-full px-4 py-3 pl-10 pr-12 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Submit"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Tips */}
                <div className="text-xs text-neutral-400 space-y-1">
                  <p>💡 Examples:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>"PTO Dec 22 to Jan 2"</li>
                    <li>"Bahamas travel next week"</li>
                    <li>"Doctor appointment tomorrow 3pm"</li>
                  </ul>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal - Small modal for viewing single event */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150" 
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseEventModal();
            }
          }}
        >
          <div 
            className="absolute inset-0 bg-black/60" 
            onMouseDown={handleCloseEventModal}
          />
          <div
            className="relative w-full max-w-md bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-100">Event Details</h3>
              <button
                onClick={handleCloseEventModal}
                className={cn(tokens.button.ghost, 'p-2')}
              >
                <X className="w-5 h-5" />
              </button>
                    </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Event info */}
              <div>
                <h4 className="text-xl font-bold text-neutral-100 mb-2">{selectedEvent.title}</h4>
                
                {/* Date range */}
                <div className="flex items-center gap-2 text-sm text-neutral-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  {selectedEvent.start_date === selectedEvent.end_date ? (
                    <span>{new Date(selectedEvent.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  ) : (
                    <span>
                      {new Date(selectedEvent.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                      {' → '}
                      {new Date(selectedEvent.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  </div>

                {/* Time */}
                {!selectedEvent.all_day && selectedEvent.start_time && (
                  <div className="text-sm text-neutral-400 mb-1">
                    {selectedEvent.start_time.slice(0, 5)}
                    {selectedEvent.end_time && ` - ${selectedEvent.end_time.slice(0, 5)}`}
                </div>
                )}

                {/* Category */}
                {selectedEvent.category && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300 mt-2">
                    {selectedEvent.category}
            </div>
                )}
              </div>

              {/* Notes */}
              {selectedEvent.notes && (
                <div className="pt-3 border-t border-neutral-700">
                  <h5 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Notes</h5>
                  <p className="text-sm text-neutral-300 whitespace-pre-wrap">{selectedEvent.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-neutral-700">
                <button
                  onClick={() => {
                    handleEditEvent(selectedEvent);
                    setSelectedDate(selectedEvent.start_date);
                    handleCloseEventModal();
                  }}
                  className={cn(tokens.button.primary, 'flex-1')}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDeleteEvent(selectedEvent.id);
                    handleCloseEventModal();
                  }}
                  className={cn(tokens.button.secondary, 'px-4')}
                  title="Delete event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button - Auto-hide with fade */}
      <button
        onClick={handleScrollToTop}
        className={cn(
          'fixed bottom-6 right-6 z-[9999] p-3 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-neutral-500',
          showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </div>
  );
};

// Day detail pane component (reused for desktop right pane and mobile bottom sheet)
interface DayDetailPaneProps {
  dayData: DayData;
  onClose: () => void;
  isCreating: boolean;
  editingEvent: CalendarEvent | null;
  onCreateEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSaveEvent: (input: CalendarEventInput, eventId?: string) => void;
  onDeleteEvent: (eventId: string) => void;
  dragEndDate?: string | null;
  onTogglePTO: (startDate: string, endDate: string, currentlyHasPTO: boolean) => void;
  onSetLocation: (startDate: string, endDate: string, location: string) => void;
}

const DayDetailPane: React.FC<DayDetailPaneProps> = ({
  dayData,
  onClose,
  isCreating,
  editingEvent,
  onCreateEvent,
  onEditEvent,
  onSaveEvent,
  onDeleteEvent,
  dragEndDate,
  onTogglePTO,
  onSetLocation,
}) => {
  const endDate = dragEndDate || dayData.date;
  const isRange = endDate !== dayData.date;
  
  // Calculate day count
  const parseDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const dayCount = isRange 
    ? Math.ceil((parseDate(endDate).getTime() - parseDate(dayData.date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 1;
  
  // Check if any day in range has PTO
  const hasPTO = dayData.events.some(e => e.is_pto);
  
  // Check if day/range has location and get it
  // For multi-day ranges, show existing location if present (user can overwrite)
  const locationEvent = dayData.events.find(e => e.category === 'location');
  const [locationInput, setLocationInput] = useState(locationEvent?.title || '');
  
  // Update location input when day changes
  useEffect(() => {
    setLocationInput(locationEvent?.title || '');
  }, [locationEvent?.title, dayData.date, endDate]);
  
  const [formData, setFormData] = useState<CalendarEventInput>({
    title: '',
    category: null,
    notes: null,
    start_date: dayData.date,
    end_date: dayData.date,
    start_time: null,
    end_time: null,
    all_day: true,
    affects_row_appearance: false,
    priority: 5,
    is_pto: false,
    source_pattern_id: null,
  });

  useEffect(() => {
    if (editingEvent) {
      setFormData({
        title: editingEvent.title,
        category: editingEvent.category,
        notes: editingEvent.notes,
        start_date: editingEvent.start_date,
        end_date: editingEvent.end_date,
        start_time: editingEvent.start_time,
        end_time: editingEvent.end_time,
        all_day: editingEvent.all_day,
        affects_row_appearance: editingEvent.affects_row_appearance,
        priority: editingEvent.priority,
        is_pto: editingEvent.is_pto,
        source_pattern_id: editingEvent.source_pattern_id,
      });
    } else {
      // Use drag end date if provided, otherwise default to same day
      const endDate = dragEndDate || dayData.date;
      
      setFormData({
        title: '',
        category: null,
        notes: null,
        start_date: dayData.date,
        end_date: endDate,
        start_time: null,
        end_time: null,
        all_day: true,
        affects_row_appearance: false,
        priority: 5,
        is_pto: false,
        source_pattern_id: null,
      });
    }
  }, [editingEvent, dayData.date, dragEndDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSaveEvent(formData, editingEvent?.id);
  };

  // Generate date display for header
  const dateDisplay = isRange
    ? (() => {
        const start = new Date(dayData.date + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endFormatted = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startMonth} - ${endFormatted}`;
      })()
    : new Date(dayData.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            {dateDisplay}
          </h3>
            {!isRange && (
          <p className="text-sm text-neutral-400 mt-1">
                {dayData.events.filter(e => !e.is_pto && e.category !== 'location').length} {dayData.events.filter(e => !e.is_pto && e.category !== 'location').length === 1 ? 'event' : 'events'}
          </p>
            )}
        </div>
        <button
          onClick={onClose}
          className={cn(tokens.button.ghost, 'p-2')}
        >
          <X className="w-5 h-5" />
        </button>
        </div>
        
        {/* PTO & Location Controls */}
        <div className="space-y-2">
          {/* PTO Toggle - Click dot to toggle */}
          <button
            onClick={() => onTogglePTO(dayData.date, endDate, hasPTO)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-lg hover:bg-neutral-800 transition-colors group"
          >
            <span 
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center transition-all',
                hasPTO 
                  ? 'bg-yellow-400 shadow-sm' 
                  : 'bg-neutral-700 group-hover:bg-neutral-600'
              )}
            >
              {hasPTO && (
                <svg className="w-3 h-3 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-300">
              Out of Office
            </span>
          </button>
          
          {/* Location Input with clear button */}
          <div className="relative">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onBlur={() => {
                if (locationInput.trim() !== (locationEvent?.title || '')) {
                  onSetLocation(dayData.date, endDate, locationInput.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              placeholder={isRange ? `📍 Location for ${dayCount} days` : "📍 Location (optional)"}
              className={cn(
                "w-full px-3 py-2 bg-neutral-800/50 rounded-lg text-sm text-neutral-300 placeholder:text-neutral-500 border border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-neutral-800 focus:outline-none transition-colors",
                locationInput && "pr-8"
              )}
            />
            {locationInput && (
              <button
                onClick={() => {
                  setLocationInput('');
                  onSetLocation(dayData.date, endDate, '');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
                title="Clear location"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Events list (exclude PTO and location - they're in the header) */}
        {!isCreating && !editingEvent && (
          <div className="space-y-3">
            {dayData.events.filter(e => !e.is_pto && e.category !== 'location').map(event => {
              const style = getCategoryStyle(event.category);
              const borderColor = getCategoryBorderColor(event.category);

              return (
                <div
                  key={event.id}
                  className={cn(
                    'group relative p-3 rounded-lg border-l-2 transition-all',
                    style.bg,
                    style.border,
                    'hover:shadow-lg'
                  )}
                  style={{ borderLeftColor: borderColor }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-neutral-100 mb-1 break-words leading-tight">
                        {event.title}
                      </h4>
                      {event.category && (
                        <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', style.text, style.bg)}>
                          {event.category}
                        </span>
                      )}
                      {!event.all_day && event.start_time && (
                        <p className="text-xs text-neutral-400 mt-1">
                          {event.start_time}
                          {event.end_time && ` - ${event.end_time}`}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-xs text-neutral-400 mt-1 break-words leading-relaxed">
                          {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditEvent(event)}
                        className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded transition-colors"
                        title="Edit event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteEvent(event.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick add input - shows when not creating */}
        {!isCreating && !editingEvent && (
          <div>
            <input
              type="text"
              placeholder="Add event..."
              onFocus={() => onCreateEvent()}
              className={cn(
                tokens.input.base,
                tokens.input.focus,
                'w-full text-sm'
              )}
            />
          </div>
        )}

        {/* Create/Edit form */}
        {(isCreating || editingEvent) && (
          <form onSubmit={handleSubmit} className={cn(tokens.card.base, 'space-y-4')}>
            {/* Section: Basic Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  What's happening? *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={cn(tokens.input.base, tokens.input.focus, 'text-base')}
                  placeholder="e.g., Dentist, Bahamas, Team Meeting"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Section: Dates */}
            <div className="space-y-3 pt-4 border-t border-neutral-700">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Start
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      start_date: e.target.value,
                      end_date: prev.end_date < e.target.value ? e.target.value : prev.end_date
                    }))}
                    className={cn(tokens.input.base, tokens.input.focus, '[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    End
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    min={formData.start_date}
                    className={cn(tokens.input.base, tokens.input.focus, '[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer')}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Optional Details */}
            <div className="pt-4 space-y-4 border-t border-neutral-700">
                {/* Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      Start Time <span className="text-neutral-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.start_time || ''}
                      onChange={(e) => {
                        const hasTime = e.target.value || formData.end_time;
                        setFormData(prev => ({ 
                          ...prev, 
                          start_time: e.target.value || null,
                          all_day: !hasTime
                        }));
                      }}
                      className={cn(tokens.select.base, 'text-sm')}
                    >
                      <option value="">--</option>
                      <option value="06:00">6:00 AM</option>
                      <option value="07:00">7:00 AM</option>
                      <option value="08:00">8:00 AM</option>
                      <option value="09:00">9:00 AM</option>
                      <option value="10:00">10:00 AM</option>
                      <option value="11:00">11:00 AM</option>
                      <option value="12:00">12:00 PM</option>
                      <option value="13:00">1:00 PM</option>
                      <option value="14:00">2:00 PM</option>
                      <option value="15:00">3:00 PM</option>
                      <option value="16:00">4:00 PM</option>
                      <option value="17:00">5:00 PM</option>
                      <option value="18:00">6:00 PM</option>
                      <option value="19:00">7:00 PM</option>
                      <option value="20:00">8:00 PM</option>
                      <option value="21:00">9:00 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      End Time <span className="text-neutral-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.end_time || ''}
                      onChange={(e) => {
                        const hasTime = formData.start_time || e.target.value;
                        setFormData(prev => ({ 
                          ...prev, 
                          end_time: e.target.value || null,
                          all_day: !hasTime
                        }));
                      }}
                      className={cn(tokens.select.base, 'text-sm')}
                    >
                      <option value="">--</option>
                      <option value="06:00">6:00 AM</option>
                      <option value="07:00">7:00 AM</option>
                      <option value="08:00">8:00 AM</option>
                      <option value="09:00">9:00 AM</option>
                      <option value="10:00">10:00 AM</option>
                      <option value="11:00">11:00 AM</option>
                      <option value="12:00">12:00 PM</option>
                      <option value="13:00">1:00 PM</option>
                      <option value="14:00">2:00 PM</option>
                      <option value="15:00">3:00 PM</option>
                      <option value="16:00">4:00 PM</option>
                      <option value="17:00">5:00 PM</option>
                      <option value="18:00">6:00 PM</option>
                      <option value="19:00">7:00 PM</option>
                      <option value="20:00">8:00 PM</option>
                      <option value="21:00">9:00 PM</option>
                    </select>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Category (optional)
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => {
                      const newCategory = e.target.value || null;
                      const newPriority = getDefaultPriority(newCategory);
                      const shouldAffectRow = newCategory?.toLowerCase() === 'travel';
                      setFormData(prev => ({ 
                        ...prev, 
                        category: newCategory,
                        priority: newPriority,
                        affects_row_appearance: shouldAffectRow
                      }));
                    }}
                    className={cn(tokens.select.base, 'text-sm')}
                  >
                    <option value="">None</option>
                    <option value="vacation">🏖️ Vacation</option>
                    <option value="holiday">🎉 Holiday</option>
                    <option value="travel">✈️ Travel</option>
                    <option value="medical">🏥 Medical</option>
                    <option value="social">👥 Social</option>
                    <option value="work">💼 Work</option>
                    <option value="personal">📌 Personal</option>
                  </select>
              </div>

                {/* Row appearance */}
                {formData.category === 'travel' && (
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.affects_row_appearance}
                  onChange={(e) => setFormData(prev => ({ ...prev, affects_row_appearance: e.target.checked }))}
                      className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500"
                />
                    <span>Highlight days with teal background</span>
              </label>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Notes <span className="text-neutral-500 font-normal">(optional)</span>
                  </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
                    className={cn(tokens.input.base, tokens.input.focus, 'min-h-[80px] resize-y text-sm')}
                    placeholder="Add any details..."
              />
            </div>
            </div>

            {/* Action Buttons - only show when title is entered */}
            {formData.title.trim() && (
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                  className={cn(tokens.button.primary, 'flex-1 py-3 font-semibold rounded-xl')}
              >
                {editingEvent ? '✓ Update Event' : '+ Create Event'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditEvent(null as any);
                  onClose();
                }}
                  className={cn(tokens.button.secondary, 'px-6 py-3 rounded-xl')}
              >
                Cancel
              </button>
            </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default CalendarTab;

