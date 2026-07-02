# Use a trusted Node.js base image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package manifests first (for layer caching)
COPY package*.json ./

# Install dependencies
ENV NODE_ENV=development
RUN npm install --include=dev --legacy-peer-deps

# Cache-bust: unique value per deploy
ARG CACHEBUST=20260310T2000

# Copy the rest of the application
COPY . .

# Embed public build-time Vite environment variables
ENV VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZm9kZGEuYWkk
ENV VITE_STRIPE_PUBLISHABLE_KEY=pk_live_5DArtkR3TY6xa2l3GtGXIo3r

# Build:
# - Vite frontend build
# - Compile API TypeScript -> dist/
# - Copy OpenAPI YAML into dist so the runtime route can serve it
RUN echo "Build timestamp: $CACHEBUST" && rm -rf dist && npm run build
# OPTIONS:
#   --something

# Cloud Run listens on PORT
ENV PORT=8080
EXPOSE 8080

# Start the compiled API server
ENV NODE_ENV=production
CMD ["npm", "start"]
