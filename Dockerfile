# Use a trusted Node.js base image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package manifests first (for layer caching)
COPY package*.json ./

# Install dependencies (no lockfile required)
RUN npm install

# Copy the rest of the application
COPY . .

# Cloud Run listens on PORT
ENV PORT=8080
EXPOSE 8080

# Start the API server
CMD ["npm", "start"]
