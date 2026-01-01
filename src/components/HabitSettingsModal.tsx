import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../theme/config';
import type { Habit } from '../types';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';

interface HabitSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHabits: Habit[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  onHabitsReordered: (habits: Habit[]) => void;
}

export const HabitSettingsModal: React.FC<HabitSettingsModalProps> = ({
  isOpen,
  onClose,
  initialHabits,
  selectedYear,
  onYearChange,
  onHabitsReordered,
}) => {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when initialHabits changes
  useEffect(() => {
    setHabits(initialHabits);
  }, [initialHabits]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newHabits = [...habits];
    const draggedItem = newHabits[draggedIndex];
    newHabits.splice(draggedIndex, 1);
    newHabits.splice(index, 0, draggedItem);

    setHabits(newHabits);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update display_order based on array index
      const habitOrders = habits.map((habit, index) => ({
        id: habit.id,
        display_order: index + 1,
      }));

      await apiClient.updateHabitDisplayOrder(habitOrders);
      
      // Update habits with new display_order
      const updatedHabits = habits.map((habit, index) => ({
        ...habit,
        display_order: index + 1,
      }));

      onHabitsReordered(updatedHabits);
      toast.success('Habit order saved');
      onClose();
    } catch (error) {
      console.error('Failed to save habit order:', error);
      toast.error('Failed to save habit order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to initial habits
    setHabits(initialHabits);
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i);

  // Habit emoji mapping (same as HabitTrackerTab)
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
    return habitEmojis[key] || habitName.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-100">Habit Settings</h3>
          <button
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Reorderable Habits List */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Habit Order (drag to reorder)
          </label>
          <div className="space-y-2">
            {habits.map((habit, index) => (
              <div
                key={habit.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move',
                  draggedIndex === index
                    ? 'bg-emerald-900/30 border-emerald-500 opacity-50'
                    : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                )}
              >
                {/* Drag Handle */}
                <svg
                  className="w-5 h-5 text-neutral-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>

                {/* Habit Emoji & Name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{getHabitEmoji(habit.name)}</span>
                  <span className="text-neutral-100 font-medium truncate">{habit.name}</span>
                </div>

                {/* Order Number */}
                <span className="text-xs text-neutral-500 bg-neutral-700 px-2 py-1 rounded">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium',
              isSaving && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default HabitSettingsModal;

