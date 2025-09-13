import React from 'react';
import { tokens, cn } from '../theme/config';
import type { Idea } from '../types';

interface IdeasCategoryTabsProps {
  ideas: Idea[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const IdeasCategoryTabs: React.FC<IdeasCategoryTabsProps> = ({
  ideas,
  activeCategory,
  onCategoryChange,
}) => {
  // Derive unique categories from ideas data
  const categories = React.useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(ideas.map(idea => idea.category).filter((cat): cat is string => Boolean(cat)))
    ).sort();
    return ['All', ...uniqueCategories];
  }, [ideas]);

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
