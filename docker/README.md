# Docker Deployment Guide

This directory contains Docker configurations for deploying the ShipFree Next.js application across different environments. All Dockerfiles use **Bun** as the runtime environment for optimal performance.

## Architecture

All Dockerfiles follow a **multi-stage build pattern** optimized for Next.js applications:

1. **Base Stage**: Sets up Bun runtime and creates non-root user for security
2. **Dependencies Stage**: Installs project dependencies using Bun
3. **Builder Stage**: Compiles and builds the Next.js application
4. **Runner Stage**: Creates minimal production image with only runtime files

### Why Multi-Stage Builds?

- **Smaller Image Size**: Final image contains only runtime dependencies
- **Better Security**: Build tools and dev dependencies are excluded
- **Faster Deployments**: Smaller images transfer and start faster
- **Layer Caching**: Optimized for Docker's build cache

## Quick Start

### Single Image Build (General Purpose)

Build and run using the main Dockerfile:

```bash
# Build the image
docker build -f docker/Dockerfile -t shipfree:latest .

# Run the container
docker run -p 3000:3000 shipfree:latest
```

### Environment-Specific Builds

#### Development Environment

```bash
# Build development image
docker-compose -f docker/development/compose.yaml build

# Start development container
docker-compose -f docker/development/compose.yaml up

# Access at http://localhost:3001
```

#### Staging Environment

```bash
# Build staging image
docker-compose -f docker/staging/compose.yaml build

# Start staging container
docker-compose -f docker/staging/compose.yaml up

# Access at http://localhost:3002
```

#### Production Environment

```bash
# Build production image
docker-compose -f docker/production/compose.yaml build

# Start production container
docker-compose -f docker/production/compose.yaml up

# Access at http://localhost:3003
```

## Configuration

### Environment Variables

Each environment Dockerfile expects environment-specific `.env` files:

- **Development**: `.env.development.sample` → `.env.production` (copied during build)
- **Staging**: `.env.staging.sample` → `.env.production` (copied during build)
- **Production**: `.env.production.sample` → `.env.production` (copied during build)

**Important**: Ensure you have the appropriate `.env.*.sample` files in your project root before building.

### Port Mapping

Default port mappings in `compose.yaml` files:

- **Development**: Host `3001` → Container `3000`
- **Staging**: Host `3002` → Container `3000`
- **Production**: Host `3003` → Container `3000`

You can modify these in the respective `compose.yaml` files.

## Dockerfile Details

### Base Image

All Dockerfiles use `oven/bun:1` as the base image, which provides:
- Latest stable Bun runtime
- Optimized for containerized environments
- Smaller footprint compared to Node.js images

### Security Best Practices

1. **Non-Root User**: Application runs as `nextjs` user (UID 1001, GID 1001)
2. **Minimal Permissions**: Only necessary files are copied with proper ownership
3. **No Build Tools in Production**: Build dependencies are excluded from final image

## Next.js Standalone Output

The project is configured with `output: 'standalone'` in `next.config.ts`, which:

- Creates a minimal `.next/standalone` directory with only required files
- Excludes unnecessary dependencies from the final image
- Significantly reduces Docker image size
- Improves container startup time

## Troubleshooting

### Build Fails with "Lockfile not found"

**Solution**: Ensure `bun.lock` exists in the project root. Run `bun install` locally to generate it.

### Container Exits Immediately

**Possible Causes**:
1. Missing environment variables
2. Database connection issues
3. Port conflicts

**Solution**: Check container logs:
```bash
docker logs <container-id>
```

### Permission Denied Errors

**Solution**: Ensure the Dockerfile properly sets ownership:
```bash
# Rebuild with --no-cache if needed
docker build --no-cache -f docker/Dockerfile -t shipfree:latest .
```

## Additional Resources

- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Bun Documentation](https://bun.sh/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker logs: `docker logs <container-id>`
3. Verify environment variables are set correctly
4. Ensure all required files are present

## Notes

- All Dockerfiles use Bun instead of Node.js
- The application runs on port 3000 inside containers
- Non-root user (`nextjs`) is used for security
- Standalone output mode is enabled for optimal image size
- Environment-specific configurations are handled via `.env` files
