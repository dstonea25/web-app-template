/**
 * Home Tab - Landing Page
 * 
 * This is the default landing page. Customize it for your app.
 */

import React from 'react';
import { Rocket, ArrowRight, Book, Palette } from 'lucide-react';
import { tokens, cn, theme, palette } from '../theme/config';

interface HomeTabProps {
  isVisible?: boolean;
}

export const HomeTab: React.FC<HomeTabProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome Card */}
      <div className={tokens.card.highlighted}>
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-xl', palette.primaryBg + '/10')}>
            <Rocket className={cn('w-8 h-8', palette.primaryText)} />
          </div>
          <div>
            <h1 className={cn('text-2xl font-bold mb-2', palette.text)}>
              Welcome to {theme.product_name}
            </h1>
            <p className={palette.textMuted}>
              This is your new web app template. It's ready to be customized for your project.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={tokens.card.base}>
          <div className="flex items-center gap-3 mb-3">
            <Book className={cn('w-5 h-5', palette.accentText)} />
            <h2 className={cn('text-lg font-semibold', palette.text)}>Read the Guide</h2>
          </div>
          <p className={cn('text-sm mb-4', palette.textMuted)}>
            Check out <code className={palette.accentText}>AGENT.md</code> for documentation on 
            how to add tabs, use components, and connect to Supabase.
          </p>
          <div className={cn('flex items-center text-sm', tokens.link.primary)}>
            <span>Open AGENT.md</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        <div className={tokens.card.base}>
          <div className="flex items-center gap-3 mb-3">
            <Palette className={cn('w-5 h-5', palette.warningText)} />
            <h2 className={cn('text-lg font-semibold', palette.text)}>Explore Components</h2>
          </div>
          <p className={cn('text-sm mb-4', palette.textMuted)}>
            Visit the Components tab to see all available UI components, 
            buttons, inputs, tables, and more.
          </p>
          <div className={cn('flex items-center text-sm', tokens.link.primary)}>
            <span>View Components</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>

      {/* Getting Started Checklist */}
      <div className={tokens.card.base}>
        <h2 className={cn('text-lg font-semibold mb-4', palette.text)}>Getting Started Checklist</h2>
        <ul className="space-y-3">
          {[
            { text: 'Update product_name in src/theme/config.ts', done: false },
            { text: 'Define your tabs in src/config/tabs.ts', done: false },
            { text: 'Create page components in src/pages/', done: false },
            { text: 'Set up Supabase and update .env', done: false },
            { text: 'Add your data types in src/types/index.ts', done: false },
            { text: 'Customize the color scheme in theme config', done: false },
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className={cn(
                'w-5 h-5 rounded border flex items-center justify-center',
                item.done 
                  ? cn(palette.successBg, palette.successBorder) 
                  : `border-${theme.colors.neutral}-600`
              )}>
                {item.done && <span className="text-white text-xs">✓</span>}
              </div>
              <span className={cn(
                'text-sm',
                item.done ? cn(palette.textSubtle, 'line-through') : `text-${theme.colors.neutral}-300`
              )}>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tech Stack Info */}
      <div className={cn(tokens.card.base, palette.bgSurfaceAlt)}>
        <h2 className={cn('text-lg font-semibold mb-3', palette.text)}>Tech Stack</h2>
        <div className="flex flex-wrap gap-2">
          {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Lucide Icons'].map((tech) => (
            <span 
              key={tech}
              className={cn(tokens.badge.base, tokens.badge.neutral)}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
