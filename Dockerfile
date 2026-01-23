# Use a trusted Node.js base image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package manifests first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build:
# - Vite frontend build
# - Compile API TypeScript -> dist/
# - Copy OpenAPI YAML into dist so the runtime route can serve it
RUN npm run build
options:
  logging: CLOUD_LOGGING_ONLY

# Cloud Run listens on PORT
ENV PORT=8080
EXPOSE 8080

# Start the compiled API server
CMD ["npm", "start"]
