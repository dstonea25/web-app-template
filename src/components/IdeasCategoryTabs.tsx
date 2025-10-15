import React from 'react';
import { tokens, cn } from '../theme/config';
import type { Idea } from '../types';
import { useWorkMode } from '../contexts/WorkModeContext';

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
  const { workMode } = useWorkMode();
  // Static categories list: show all even if empty, plus any ad-hoc ones in data
  const categories = React.useMemo(() => {
    if (workMode) return ['work'];
    const staticCats = ['work','projects','videos','writing','health','business','life','future','travel'];
    const dynamicCats = Array.from(
      new Set(ideas.map(idea => idea.category).filter((cat): cat is string => Boolean(cat)))
    ).sort();
    const merged = Array.from(new Set([...staticCats, ...dynamicCats]));
    return ['All', ...merged];
  }, [ideas, workMode]);

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
