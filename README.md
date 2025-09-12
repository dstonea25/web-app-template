# Dashboard - React + TypeScript + Vite

A modern dashboard application built with React, TypeScript, and Vite, containerized for easy deployment on NAS or any Docker environment.

## Features

- ⚡ Fast development with Vite
- ⚛️ React 19 with TypeScript
- 🎨 Tailwind CSS for styling
- 📱 Responsive design
- 🐳 Docker containerized
- 🚀 Production-ready nginx setup

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed on your system
- Git (to clone the repository)

### Running with Docker Compose

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo-url>
   cd Dashboard
   ```

2. **Build and start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Open your browser and go to `http://localhost:3000`
   - The app will be available on port 3000

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Docker Commands

- **Build the image:**
  ```bash
  docker build -t dashboard-app .
  ```

- **Run the container:**
  ```bash
  docker run -p 3000:8080 dashboard-app
  ```

- **View logs:**
  ```bash
  docker-compose logs -f dashboard
  ```

- **Rebuild after changes:**
  ```bash
  docker-compose up --build -d
  ```

## Development

### Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## Production Deployment

The Docker setup includes:

- **Multi-stage build** for optimized image size
- **Nginx** as a production web server
- **Security headers** for enhanced security
- **Gzip compression** for better performance
- **Health checks** for container monitoring
- **Non-root user** for security
- **Persistent data storage** via volume mounts

### NAS Deployment

For NAS deployment, ensure:

1. Your NAS supports Docker and Docker Compose
2. Port 3000 is accessible from your network
3. Data persistence is configured via volume mounts

### Environment Variables

The application can be configured using environment variables in the `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
```

## Project Structure

```
src/
├── components/          # React components
├── pages/              # Page components
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
└── theme/              # Theme configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Container:** Docker, Nginx
- **Build Tool:** Vite

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
