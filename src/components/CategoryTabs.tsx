import React from 'react';
import { tokens, cn } from '../theme/config';
import type { Todo } from '../types';
import { useWorkMode } from '../contexts/WorkModeContext';

interface CategoryTabsProps {
  todos: Todo[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  todos,
  activeCategory,
  onCategoryChange,
}) => {
  const { workMode } = useWorkMode();
  // Derive unique categories from todos data
  const categories = React.useMemo(() => {
    if (workMode) {
      return ['work'];
    }
    const uniqueCategories = Array.from(
      new Set(todos.map(todo => todo.category).filter((cat): cat is string => Boolean(cat)))
    ).sort();
    return ['All', ...uniqueCategories];
  }, [todos, workMode]);

  return (
    <div className={tokens.tabs.list}>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={cn(
            tokens.tabs.trigger,
            activeCategory === category && 'bg-neutral-800/70'
          )}
          data-active={activeCategory === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
