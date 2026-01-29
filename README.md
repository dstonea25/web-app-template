# Web App Template

A production-ready starter template for React web applications with a beautiful dark-mode UI, responsive navigation, and Supabase backend integration.

## Tech Stack

- **React** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Supabase** - Backend (auth, database)
- **Lucide Icons** - Icon library

## Features

- Responsive sidebar navigation (desktop) + drawer (mobile)
- Dark mode UI with consistent design tokens
- Tab-based routing without React Router
- Authentication flow ready
- Docker deployment ready
- Component showcase included

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── AppShell.tsx    # Main layout
│   ├── Sidebar.tsx     # Desktop navigation
│   └── ...
├── pages/          # Tab page components
├── config/
│   └── tabs.ts     # Tab registry (navigation config)
├── theme/
│   └── config.ts   # Design tokens and colors
├── lib/
│   └── api.ts      # API client / Supabase operations
├── contexts/       # React contexts
└── types/          # TypeScript definitions
```

## Adding a New Tab

1. Add tab ID to `src/config/tabs.ts`
2. Create page component in `src/pages/`
3. Wire it up in `src/components/AppShell.tsx`

See [AGENT.md](./AGENT.md) for detailed instructions.

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment

### Docker

```bash
docker build -t my-app \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  .

docker run -p 3000:8080 my-app
```

### Docker Compose

```bash
docker-compose up -d
```

## Documentation

See [AGENT.md](./AGENT.md) for comprehensive documentation on:
- Architecture overview
- Adding tabs/pages
- Using design tokens
- Connecting to Supabase
- Responsive design patterns
- Deployment checklist

## License

MIT
