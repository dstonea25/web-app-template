# Authentication Setup

This dashboard includes basic password protection using environment variables for credentials.

## Environment Variables

The authentication system uses the following environment variables:

- `VITE_AUTH_USERNAME` - Username for login
- `VITE_AUTH_PASSWORD` - Password for login

## Setting Custom Credentials

### Option 1: Environment Variables

Set the environment variables before running the application:

```bash
export VITE_AUTH_USERNAME="your_username"
export VITE_AUTH_PASSWORD="your_secure_password"
./start-production.sh
```

### Option 2: .env File

Create a `.env` file in the project root:

```bash
VITE_AUTH_USERNAME=your_username
VITE_AUTH_PASSWORD=your_secure_password
```

### Option 3: Docker Environment

Pass environment variables to Docker:

```bash
VITE_AUTH_USERNAME=your_username VITE_AUTH_PASSWORD=your_secure_password docker-compose up --build -d
```

## Security Notes

- **Change default credentials** in production
- **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
- **Environment variables** are embedded in the build, so use secure deployment practices
- **Consider HTTPS** for production deployments
- **Session persistence** uses localStorage (clears on browser data clear)

## Features

- ✅ **Themed login form** matching app design
- ✅ **Environment variable configuration**
- ✅ **Session persistence** (remembers login)
- ✅ **Logout functionality** (desktop & mobile)
- ✅ **Loading states** and error handling
- ✅ **Password visibility toggle**
- ✅ **Responsive design**

## Development

For development, you can temporarily disable authentication by commenting out the `ProtectedRoute` wrapper in `src/App.tsx`.
