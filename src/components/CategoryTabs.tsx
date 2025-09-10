import React from 'react';
import { tokens, cn } from '../theme/config';
import type { Todo } from '../types';

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
  // Derive unique categories from todos data
  const categories = React.useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(todos.map(todo => todo.category).filter((cat): cat is string => Boolean(cat)))
    ).sort();
    return ['All', ...uniqueCategories];
  }, [todos]);

  return (
    <div className={tokens.tabs.list}>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={cn(
            tokens.tabs.trigger,
            activeCategory === category && 'data-[active=true]:bg-slate-800/70'
          )}
          data-active={activeCategory === category}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
