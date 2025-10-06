import React, { useState, useEffect, useRef } from 'react';
import type { Session } from '../types';
import { cn, tokens } from '../theme/config';
import { 
  nowIso, 
  msToTimerDisplay,
  computeDurationMinutes, 
  getDateAtMidnight,
  addMinutes,
  generateId,
  MAX_TIMER_MS,
  MAX_TIMER_MINUTES
} from '../lib/time';
import { fetchSessionsFromWebhook, saveSessionsToWebhook, fetchRecentSessionsFromWebhook, deleteSessionsFromWebhook } from '../lib/api';
import { toast } from '../lib/notifications/toast';
import { useTimer } from '../contexts/TimerContext';
import RecentSessionsTable from '../components/RecentSessionsTable';

// Mock data from the scope
const MOCK_DATA = {
  now: "2025-09-14T12:00:00Z",
  sessions: [
    {"id":"01JAAAAA1","category":"Work","startedAt":"2025-09-08T14:00:00Z","endedAt":"2025-09-08T16:00:00Z","minutes":120},
    {"id":"01JAAAAA2","category":"Gaming","startedAt":"2025-09-09T01:00:00Z","endedAt":"2025-09-09T03:30:00Z","minutes":150},
    {"id":"01JAAAAA3","category":"Personal Projects","startedAt":"2025-09-10T15:00:00Z","endedAt":"2025-09-10T16:15:00Z","minutes":75},
    {"id":"01JAAAAA4","category":"Work","startedAt":"2025-09-11T13:30:00Z","endedAt":"2025-09-11T15:00:00Z","minutes":90},
    {"id":"01JAAAAA5","category":"Gaming","startedAt":"2025-09-12T02:00:00Z","endedAt":"2025-09-12T04:00:00Z","minutes":120},
    {"id":"01JAAAAA6","category":"Personal Projects","startedAt":"2025-09-13T17:00:00Z","endedAt":"2025-09-13T18:00:00Z","minutes":60}
  ]
};

const CATEGORIES = ['Gaming', 'Personal Projects', 'Work'] as const;
type Category = typeof CATEGORIES[number];

interface PendingSession {
  id: string;
  category: Category;
  startedAt: string;
  endedAt: string;
  minutes: number;
}

export const TimeTrackingTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const { setActive: setCtxActive, resetElapsed } = useTimer();
  // Core state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timerCategory, setTimerCategory] = useState<Category | null>(null);
  const [activeSession, setActiveSession] = useState<{ startedAt: string; category: Category } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  
  // Chart state
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'ytd'>('week');
  const [chartCategory, setChartCategory] = useState<Category>('Gaming');
  
  // Manual add state
  const [manualDate, setManualDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [manualCategory, setManualCategory] = useState<Category>('Gaming');
  const [manualHours, setManualHours] = useState('1');
  const [manualMinutes, setManualMinutes] = useState('0');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualHoursRef = useRef<HTMLInputElement | null>(null);
  const autoStoppedRef = useRef(false);

  const hasInitializedRef = useRef(false);

  // Initialize tab when it mounts (only happens when tab is active)
  useEffect(() => {
    if (!isVisible || hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    initializeTimeTab();
  }, [isVisible]);

  // Timer effect gated by visibility
  useEffect(() => {
    if (activeSession && isVisible) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const startTime = new Date(activeSession.startedAt);
        setElapsedMs(now.getTime() - startTime.getTime());
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeSession, isVisible]);

  // Handle visibility change to recalculate timer
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (activeSession && !document.hidden) {
        const now = new Date();
        const startTime = new Date(activeSession.startedAt);
        setElapsedMs(now.getTime() - startTime.getTime());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeSession]);

  const initializeTimeTab = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load sessions from backend
      console.log('🌐 Loading sessions...');
      const loaded = await fetchSessionsFromWebhook();
      console.log('✅ Sessions loaded:', loaded);
      setSessions(loaded as Session[]);
      // Set chart to most recently updated category
      try {
        if (Array.isArray(loaded) && loaded.length > 0) {
          const latest = [...loaded].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
          if (latest && (['Gaming','Personal Projects','Work'] as const).includes(latest.category as any)) {
            setChartCategory(latest.category as Category);
            // Also default manual add category to latest
            setManualCategory(latest.category as Category);
          }
        }
      } catch {}
      // Load recent sessions (limit 5)
      try {
        const recent = await fetchRecentSessionsFromWebhook(5);
        setRecentSessions(recent);
      } catch (e) {
        // non-fatal
      }
      
      // Restore active session from localStorage
      const stored = localStorage.getItem('geronimo.time.activeSession');
      if (stored) {
        try {
          const active = JSON.parse(stored);
          const now = new Date();
          const startTime = new Date(active.startedAt);
          const diff = now.getTime() - startTime.getTime();
          if (diff >= MAX_TIMER_MS) {
            // Auto-stop at cap without resuming the active session
            const endedAt = addMinutes(active.startedAt, MAX_TIMER_MINUTES);
            const pending: PendingSession = {
              id: generateId(),
              category: active.category,
              startedAt: active.startedAt,
              endedAt,
              minutes: MAX_TIMER_MINUTES
            };
            setPendingSession(pending);
            setActiveSession(null);
            setElapsedMs(MAX_TIMER_MS);
            localStorage.removeItem('geronimo.time.activeSession');
            setCtxActive(null);
            autoStoppedRef.current = true;
            toast.info('Timer auto-stopped at 6h cap');
          } else {
            setActiveSession(active);
            setCtxActive(active);
            setElapsedMs(diff);
          }
        } catch (e) {
          localStorage.removeItem('geronimo.time.activeSession');
        }
      }
      
      // Restore last used category
      const lastCategory = localStorage.getItem('geronimo.time.lastCategory');
      if (lastCategory && CATEGORIES.includes(lastCategory as Category)) {
        setTimerCategory(lastCategory as Category);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load sessions');
      // Fall back to mock data on error
      console.log('🔄 Falling back to mock data');
      const mock = MOCK_DATA.sessions as Session[];
      setSessions(mock);
      setRecentSessions(mock.slice(-5).reverse());
      // Set chart to most recently updated category from mock
      if (mock.length > 0) {
        const latest = [...mock].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
        setChartCategory(latest.category as Category);
        setManualCategory(latest.category as Category);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectCategory = (category: Category) => {
    setTimerCategory(category);
    localStorage.setItem('geronimo.time.lastCategory', category);
  };

  const selectChartCategory = (category: Category) => {
    setChartCategory(category);
  };

  const startTimer = () => {
    if (!timerCategory) return;
    
    const startedAt = nowIso();
    const active = { startedAt, category: timerCategory };
    
    setActiveSession(active);
    setElapsedMs(0);
    localStorage.setItem('geronimo.time.activeSession', JSON.stringify(active));
    setCtxActive(active);
    autoStoppedRef.current = false;
  };

  const stopTimer = () => {
    if (!activeSession) return;
    
    const now = nowIso();
    const rawMinutes = computeDurationMinutes(activeSession.startedAt, now);
    const isCapped = rawMinutes > MAX_TIMER_MINUTES;
    const minutes = Math.min(rawMinutes, MAX_TIMER_MINUTES);
    const endedAt = isCapped ? addMinutes(activeSession.startedAt, MAX_TIMER_MINUTES) : now;
    
    const pending: PendingSession = {
      id: generateId(),
      category: activeSession.category,
      startedAt: activeSession.startedAt,
      endedAt,
      minutes
    };
    
    setPendingSession(pending);
    setActiveSession(null);
    // Keep the elapsed time for display - don't reset to 0
    setElapsedMs(isCapped ? MAX_TIMER_MS : elapsedMs); // Keep current elapsed time, capped
    localStorage.removeItem('geronimo.time.activeSession');
    setCtxActive(null);
    if (isCapped) toast.info('Timer auto-stopped at 6h cap');
  };

  const resetTimer = () => {
    setPendingSession(null);
    setElapsedMs(0);
    setJustSubmitted(false);
    resetElapsed();
  };

  const continueTimer = () => {
    if (!pendingSession || !timerCategory) return;
    
    // Calculate new start time based on current elapsed time
    const now = new Date();
    const newStartedAt = new Date(now.getTime() - elapsedMs).toISOString();
    const active = { startedAt: newStartedAt, category: timerCategory };
    
    setActiveSession(active);
    setPendingSession(null);
    localStorage.setItem('geronimo.time.activeSession', JSON.stringify(active));
    setCtxActive(active);
    autoStoppedRef.current = false;
  };


  const submitPendingSession = async () => {
    if (!pendingSession) return;
    
    try {
      // Create new session
      const newSession: Session = {
        id: pendingSession.id,
        category: pendingSession.category,
        startedAt: pendingSession.startedAt,
        endedAt: pendingSession.endedAt,
        minutes: pendingSession.minutes
      };
      
      // Add to local sessions first
      const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
      
      // Save to backend
      await saveSessionsToWebhook([newSession]);
      
      // Refresh data to get latest
      const [all, recent] = await Promise.all([
        fetchSessionsFromWebhook(),
        fetchRecentSessionsFromWebhook(5),
      ]);
      setSessions(all as Session[]);
      setRecentSessions(recent as Session[]);
      
      // Show success toast
      toast.success(`Session submitted: ${pendingSession.minutes} minutes of ${pendingSession.category}`);
      
      // Switch chart to the category that was just submitted (if within current time period)
      const sessionDate = new Date(pendingSession.startedAt).toISOString().split('T')[0];
      if (isDateInCurrentTimePeriod(sessionDate)) {
        setChartCategory(pendingSession.category);
      }
      
      // Clear pending session and mark as just submitted
      setPendingSession(null);
      setJustSubmitted(true);
    } catch (error) {
      console.error('Failed to submit session:', error);
      toast.error('Failed to submit session');
    }
  };

  const handleHoursChange = (value: string) => {
    const num = parseInt(value) || 0;
    setManualHours(Math.max(0, Math.min(23, num)).toString());
  };

  const handleMinutesChange = (value: string) => {
    const num = parseInt(value) || 0;
    setManualMinutes(Math.max(0, Math.min(59, num)).toString());
  };

  const isFormValid = () => {
    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;
    return manualDate && manualCategory && (hours > 0 || minutes > 0) && !isSubmitting;
  };

  const isDateInCurrentTimePeriod = (date: string) => {
    const sessionDate = new Date(date);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Calculate date range based on current time period
    let rangeStart = new Date();
    if (timePeriod === 'week') {
      // Get start of current week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      rangeStart.setDate(now.getDate() + mondayOffset);
      rangeStart.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'month') {
      // Start of current month
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'ytd') {
      // Start of current year
      rangeStart.setMonth(0, 1);
      rangeStart.setHours(0, 0, 0, 0);
    }
    
    const sessionYear = sessionDate.getFullYear();
    return sessionYear === currentYear && sessionDate >= rangeStart;
  };

  const addManualSession = async () => {
    if (!isFormValid() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const startedAt = getDateAtMidnight(manualDate);
      const hours = Math.max(0, Math.min(23, parseInt(manualHours) || 0));
      const minutes = Math.max(0, Math.min(59, parseInt(manualMinutes) || 0));
      const totalMinutes = (hours * 60) + minutes;
      
      if (totalMinutes === 0) {
        toast.error('Please enter a duration greater than 0');
        setIsSubmitting(false);
        return;
      }
      
      const endedAt = addMinutes(startedAt, totalMinutes);
      
      const session: Session = {
        id: generateId(),
        category: manualCategory,
        startedAt,
        endedAt,
        minutes: totalMinutes
      };
      
      // Add to local sessions first
      setSessions(prev => [...prev, session]);
      
      // Save to backend
      await saveSessionsToWebhook([session]);
      
      // Refresh data to get latest
      const [all, recent] = await Promise.all([
        fetchSessionsFromWebhook(),
        fetchRecentSessionsFromWebhook(5),
      ]);
      setSessions(all as Session[]);
      setRecentSessions(recent as Session[]);
      
      // Show success toast
      const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      toast.success(`Time added: ${timeDisplay} of ${manualCategory}`);
      
      // Switch chart to the category that was just added (if within current time period)
      if (isDateInCurrentTimePeriod(manualDate)) {
        setChartCategory(manualCategory);
      }
      
      // Keep selected date and category; reset duration to 0h 0m and focus hours
      setManualHours('0');
      setManualMinutes('0');
      setTimeout(() => {
        manualHoursRef.current?.focus();
        manualHoursRef.current?.select();
      }, 0);
    } catch (error) {
      console.error('Failed to add manual session:', error);
      toast.error('Failed to add time session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSessionsFromWebhook([id]);
      const [all, recent] = await Promise.all([
        fetchSessionsFromWebhook(),
        fetchRecentSessionsFromWebhook(5),
      ]);
      setSessions(all as Session[]);
      setRecentSessions(recent as Session[]);
      // After delete, set chart to most recent remaining session's category if available
      if (Array.isArray(all) && (all as Session[]).length > 0) {
        const latest = [...(all as Session[])].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
        setChartCategory(latest.category as Category);
      }
      toast.success('Session deleted');
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session');
    }
  };

  const handleUpsertSession = async (updated: Session) => {
    try {
      await saveSessionsToWebhook([updated]);
      const [all, recent] = await Promise.all([
        fetchSessionsFromWebhook(),
        fetchRecentSessionsFromWebhook(5),
      ]);
      setSessions(all as Session[]);
      setRecentSessions(recent as Session[]);
      // Immediately reflect the edited session's category in chart
      setChartCategory(updated.category as Category);
      toast.success('Session updated');
    } catch (error) {
      console.error('Failed to update session:', error);
      toast.error('Failed to update session');
    }
  };

  // Auto-stop when exceeding cap while ticking on the visible tab
  useEffect(() => {
    if (!isVisible || !activeSession) return;
    if (elapsedMs >= MAX_TIMER_MS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      const endedAt = addMinutes(activeSession.startedAt, MAX_TIMER_MINUTES);
      const pending: PendingSession = {
        id: generateId(),
        category: activeSession.category,
        startedAt: activeSession.startedAt,
        endedAt,
        minutes: MAX_TIMER_MINUTES
      };
      setPendingSession(pending);
      setActiveSession(null);
      setElapsedMs(MAX_TIMER_MS);
      localStorage.removeItem('geronimo.time.activeSession');
      setCtxActive(null);
      toast.info('Timer auto-stopped at 6h cap');
    }
  }, [elapsedMs, isVisible, activeSession]);

  // Compute daily hours for selected category and time period
  const computeDailyStats = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Calculate date range based on time period
    let rangeStart = new Date();
    if (timePeriod === 'week') {
      // Get start of current week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, so go back 6 days
      rangeStart.setDate(now.getDate() + mondayOffset);
      rangeStart.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'month') {
      // Start of current month
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'ytd') {
      // Start of current year
      rangeStart.setMonth(0, 1);
      rangeStart.setHours(0, 0, 0, 0);
    }
    
    // Filter sessions by date range and selected category
    const filteredSessions = sessions.filter(session => {
      const sessionDate = new Date(session.startedAt);
      const sessionYear = sessionDate.getFullYear();
      return sessionYear === currentYear && 
             sessionDate >= rangeStart && 
             session.category === chartCategory;
    });
    
    // Group by day of week
    const byDayOfWeek: { [key: string]: number } = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    filteredSessions.forEach(session => {
      const sessionDate = new Date(session.startedAt);
      const dayOfWeek = dayNames[sessionDate.getDay()];
      byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + session.minutes;
    });
    
    // Return in Monday-first order with all days (0 if no data)
    const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const result: { [key: string]: number } = {};
    orderedDays.forEach(day => {
      result[day] = byDayOfWeek[day] || 0;
    });
    
    return result;
  };

  // Compute category comparison for all time periods
  const computeCategoryComparison = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const periods = {
      week: { start: new Date(), label: 'This Week' },
      month: { start: new Date(), label: 'This Month' },
      ytd: { start: new Date(), label: 'Year to Date' }
    };
    
    // Set start dates correctly
    // Week: Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    periods.week.start.setDate(now.getDate() + mondayOffset);
    periods.week.start.setHours(0, 0, 0, 0);
    
    // Month: Start of current month
    periods.month.start.setDate(1);
    periods.month.start.setHours(0, 0, 0, 0);
    
    // YTD: Start of current year
    periods.ytd.start.setMonth(0, 1);
    periods.ytd.start.setHours(0, 0, 0, 0);
    
    const results: { [key: string]: { [category: string]: number } } = {};
    
    Object.entries(periods).forEach(([period, config]) => {
      const filteredSessions = sessions.filter(session => {
        const sessionYear = new Date(session.startedAt).getFullYear();
        const sessionDate = new Date(session.startedAt);
        return sessionYear === currentYear && sessionDate >= config.start;
      });
      
      // Initialize all categories with 0
      const byCategory: { [key: string]: number } = {
        'Gaming': 0,
        'Personal Projects': 0,
        'Work': 0
      };
      
      // Add actual data
      filteredSessions.forEach(session => {
        byCategory[session.category] = (byCategory[session.category] || 0) + session.minutes;
      });
      
      results[period] = byCategory;
    });
    
    return results;
  };

  const dailyStats = computeDailyStats();
  const categoryComparison = computeCategoryComparison();
  
  // Get chart color based on selected category
  const getChartColor = (category: Category) => {
    switch (category) {
      case 'Gaming':
        return '#fbbf24'; // amber-400 (matches category pill)
      case 'Personal Projects':
        return '#2dd4bf'; // teal-400 (matches category pill)
      case 'Work':
        return '#10b981'; // emerald-500 (matches category pill)
      default:
        return '#10b981'; // emerald-500 fallback
    }
  };
  
  console.log('Daily stats:', dailyStats);
  console.log('Chart category:', chartCategory);
  console.log('Time period:', timePeriod);

  // Loading state (when hidden, render nothing to avoid stale time flash)
  if (loading) {
    if (!isVisible) return <div className="hidden" />;
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-neutral-400">Loading time tracking data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    if (!isVisible) return <div className="hidden" />;
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-neutral-100 mb-2">Failed to load data</h3>
            <p className="text-neutral-400 mb-4">{error}</p>
            <button
              onClick={() => initializeTimeTab()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("max-w-6xl mx-auto px-4 sm:px-6 lg:px-8", !isVisible && 'hidden')}>
      {/* Timer and Session Editor */}
      <div className="mb-6">
        <div className={tokens.time.timerCard.wrapper}>
          <div className="w-full text-left">
            <h3 className="text-lg font-semibold mb-4 text-neutral-100">Time Tracker</h3>
            
            {/* Category Selection */}
            <div className="mb-4">
              <div className="flex items-center gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => selectCategory(category)}
                    className={cn(
                      tokens.time.categoryPills.pill,
                      category === 'Gaming' && tokens.time.categoryPills.gaming,
                      category === 'Personal Projects' && tokens.time.categoryPills.personal,
                      category === 'Work' && tokens.time.categoryPills.work,
                      timerCategory === category && "data-[active=true]"
                    )}
                    data-active={timerCategory === category}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timer Display */}
          <div className={tokens.time.timerCard.time} aria-live="polite">
            {msToTimerDisplay(elapsedMs)}
          </div>
          <div className={tokens.time.timerCard.state}>
            {activeSession ? (
              <span className="flex items-center gap-2">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span>
                  Started at: {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </span>
            ) : pendingSession ? (
              <span>
                Started at: {new Date(pendingSession.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            ) : justSubmitted ? 'Submitted' : (timerCategory ? 'Ready' : 'Select a category to start')}
          </div>
          <div className={tokens.time.timerCard.actions}>
            {activeSession ? (
              <button
                onClick={stopTimer}
                className={tokens.button.base + ' ' + tokens.button.primary}
              >
                Stop
              </button>
            ) : (pendingSession || justSubmitted) ? (
              <div className="flex gap-2">
                <button
                  onClick={continueTimer}
                  disabled={!timerCategory}
                  className={cn(tokens.button.base, tokens.button.primary, "disabled:opacity-50 disabled:cursor-not-allowed")}
                >
                  Continue
                </button>
                <button
                  onClick={resetTimer}
                  className={tokens.button.base + ' ' + tokens.button.secondary}
                >
                  Reset
                </button>
              </div>
            ) : (
              <button
                onClick={startTimer}
                disabled={!timerCategory}
                className={cn(tokens.button.base, tokens.button.primary, "disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                Start
              </button>
            )}
          </div>

          {/* Pending Session Editor */}
          {pendingSession && (
            <div className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,200px)_minmax(0,200px)_minmax(0,120px)] gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-100">Category</label>
                  <select
                    value={pendingSession.category}
                    onChange={(e) => setPendingSession({...pendingSession, category: e.target.value as Category})}
                    className="px-3 py-2 border border-neutral-800 rounded-lg bg-neutral-900 text-neutral-100 w-full"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-100">Duration (minutes)</label>
                  <input
                    type="number"
                    value={pendingSession.minutes}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0;
                      const endedAt = addMinutes(pendingSession.startedAt, minutes);
                      setPendingSession({...pendingSession, minutes, endedAt});
                    }}
                    className="px-3 py-2 border border-neutral-800 rounded-lg bg-neutral-900 text-neutral-100 w-full"
                    placeholder="60"
                  />
                </div>
                <div>
                  <button
                    onClick={submitPendingSession}
                    className={cn(tokens.button.base, tokens.button.primary, "w-full")}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Add Panel */}
      <div className={tokens.time.manualAdd.wrapper}>
        <h3 className="text-lg font-semibold mb-4 text-neutral-100">Add Time</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-100">Date</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className={tokens.input.date}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-100">Category</label>
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value as Category)}
              className={tokens.input.base}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-100">Duration</label>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={manualHours}
                  onChange={(e) => handleHoursChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && isFormValid()) addManualSession(); }}
                  ref={(el) => { manualHoursRef.current = el; }}
                  className={cn(tokens.input.base, "w-16")}
                  placeholder="1"
                  min="0"
                  max="23"
                />
                <span className="text-sm text-neutral-400">h</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={manualMinutes}
                  onChange={(e) => handleMinutesChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && isFormValid()) addManualSession(); }}
                  className={cn(tokens.input.base, "w-16")}
                  placeholder="0"
                  min="0"
                  max="59"
                />
                <span className="text-sm text-neutral-400">m</span>
              </div>
            </div>
          </div>
          <div>
            <button
              onClick={addManualSession}
              disabled={!isFormValid()}
              className={cn(
                tokens.button.base, 
                tokens.button.primary,
                "px-4 py-2",
                !isFormValid() && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? 'Adding...' : 'Add Time'}
            </button>
          </div>
        </div>
      </div>


      {/* Charts */}
      <div className={tokens.time.charts.container}>
        {/* Daily Hours Chart - Single Category */}
        <div className={tokens.time.charts.panel}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-neutral-100">
              Daily Hours - {chartCategory}
            </h3>
            
            {/* Time Period Filter */}
            <div className="flex gap-2">
              {(['week', 'month', 'ytd'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors",
                    timePeriod === period 
                      ? "bg-neutral-700 text-white border-neutral-600" 
                      : "bg-transparent text-neutral-400 border-neutral-600 hover:border-neutral-500"
                  )}
                >
                  {period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'Year to Date'}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mb-6">
            {CATEGORIES.map((category) => (
                    <button
                key={category}
                onClick={() => selectChartCategory(category)}
                className={cn(
                  tokens.time.categoryPills.pill,
                  chartCategory === category && "data-[active=true]",
                  category === 'Gaming' && tokens.time.categoryPills.gaming,
                  category === 'Personal Projects' && tokens.time.categoryPills.personal,
                  category === 'Work' && tokens.time.categoryPills.work
                )}
                data-active={chartCategory === category}
              >
                {category}
                    </button>
            ))}
          </div>

          <div className="flex justify-center items-end space-x-4 h-40">
            {(() => {
              const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              const dayAbbrevs = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              
              return orderedDays.map((day, index) => {
                const minutes = dailyStats[day] || 0;
                const hours = (minutes / 60).toFixed(1);
                const maxHours = 8; // Max height for scaling
                const heightPercent = Math.min((minutes / 60) / maxHours * 100, 100);
                
                return (
                  <div key={day} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-neutral-100 mb-2">{hours}h</div>
                    <div className="w-8 h-32 bg-neutral-800 rounded-t-lg relative flex items-end">
                      <div 
                        className="w-full rounded-t-lg transition-all duration-300"
                        style={{ 
                          height: `${heightPercent}%`,
                          backgroundColor: getChartColor(chartCategory)
                        }}
                      />
                    </div>
                    <div className="text-xs text-neutral-400 mt-2 text-center max-w-16">{dayAbbrevs[index]}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Category Comparison Chart - All Categories, All Time Periods */}
        <div className={tokens.time.charts.panel}>
          <h3 className="text-lg font-semibold mb-4 text-neutral-100">Category Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* This Week */}
            <div>
              <h4 className="text-sm font-medium text-neutral-300 mb-4 text-center">This Week</h4>
              <div className="flex justify-center items-end space-x-4 h-40">
                {Object.entries(categoryComparison.week).map(([category, minutes]) => {
                  const hours = (minutes / 60).toFixed(1);
                  const maxHours = 8; // Max height for scaling
                  const heightPercent = Math.min((minutes / 60) / maxHours * 100, 100);
                  
                  return (
                    <div key={category} className="flex flex-col items-center">
                      <div className="text-xs font-medium text-neutral-100 mb-2">{hours}h</div>
                      <div className="w-8 h-32 bg-neutral-800 rounded-t-lg relative flex items-end">
                        <div 
                          className="w-full rounded-t-lg transition-all duration-300"
                          style={{ 
                            height: `${heightPercent}%`,
                            backgroundColor: getChartColor(category as Category)
                          }}
                        />
                      </div>
                      <div className="text-xs text-neutral-400 mt-2 text-center max-w-16">
                        {category === 'Personal Projects' ? 'Personal' : category}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* This Month */}
            <div>
              <h4 className="text-sm font-medium text-neutral-300 mb-4 text-center">This Month</h4>
              <div className="flex justify-center items-end space-x-4 h-40">
                {Object.entries(categoryComparison.month).map(([category, minutes]) => {
                  const hours = (minutes / 60).toFixed(1);
                  const maxHours = 8; // Max height for scaling
                  const heightPercent = Math.min((minutes / 60) / maxHours * 100, 100);
                  
                  return (
                    <div key={category} className="flex flex-col items-center">
                      <div className="text-xs font-medium text-neutral-100 mb-2">{hours}h</div>
                      <div className="w-8 h-32 bg-neutral-800 rounded-t-lg relative flex items-end">
                        <div 
                          className="w-full rounded-t-lg transition-all duration-300"
                          style={{ 
                            height: `${heightPercent}%`,
                            backgroundColor: getChartColor(category as Category)
                          }}
                        />
                      </div>
                      <div className="text-xs text-neutral-400 mt-2 text-center max-w-16">
                        {category === 'Personal Projects' ? 'Personal' : category}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Year to Date */}
            <div>
              <h4 className="text-sm font-medium text-neutral-300 mb-4 text-center">Year to Date</h4>
              <div className="flex justify-center items-end space-x-4 h-40">
                {Object.entries(categoryComparison.ytd).map(([category, minutes]) => {
                  const hours = (minutes / 60).toFixed(1);
                  const maxHours = 8; // Max height for scaling
                  const heightPercent = Math.min((minutes / 60) / maxHours * 100, 100);
                  
                  return (
                    <div key={category} className="flex flex-col items-center">
                      <div className="text-xs font-medium text-neutral-100 mb-2">{hours}h</div>
                      <div className="w-8 h-32 bg-neutral-800 rounded-t-lg relative flex items-end">
                        <div 
                          className="w-full rounded-t-lg transition-all duration-300"
                          style={{ 
                            height: `${heightPercent}%`,
                            backgroundColor: getChartColor(category as Category)
                          }}
                        />
                      </div>
                      <div className="text-xs text-neutral-400 mt-2 text-center max-w-16">
                        {category === 'Personal Projects' ? 'Personal' : category}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <RecentSessionsTable
        sessions={recentSessions}
        categories={CATEGORIES as unknown as Session['category'][]}
        onUpsert={handleUpsertSession}
        onDelete={handleDeleteSession}
      />
    </div>
  );
};