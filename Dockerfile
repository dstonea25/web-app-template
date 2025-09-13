# Multi-stage build for production React app from private GitHub repo
FROM node:20-alpine AS builder

# Install git and openssh
RUN apk add --no-cache git openssh-client

# Set working directory
WORKDIR /app

# Copy SSH key and set permissions
COPY .ssh /root/.ssh
RUN chmod 700 /root/.ssh && \
    chmod 600 /root/.ssh/id_ed25519

# Add GitHub to known_hosts
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# Set build-time environment variables
ARG VITE_AUTH_USERNAME=admin
ARG VITE_AUTH_PASSWORD=password123
ARG GITHUB_REPO

# Set environment variables for build
ENV VITE_AUTH_USERNAME=$VITE_AUTH_USERNAME
ENV VITE_AUTH_PASSWORD=$VITE_AUTH_PASSWORD

# Clone the private repository
RUN git clone git@github.com:${GITHUB_REPO}.git /app

# Install dependencies
RUN npm ci

# Build the application
RUN npm run build

# Production stage with http-server
FROM node:20-alpine AS production

# Install http-server globally
RUN npm install -g http-server

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G appuser -g appuser appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start http-server
CMD ["http-server", "dist", "-p", "8080", "-a", "0.0.0.0", "--cors"]
