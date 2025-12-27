# Use a trusted Node runtime image
FROM node:22-slim

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the repo
COPY . .

# Optional: build the Vite UI (won't hurt API-only, but may fail if Vite config is incomplete)
# If this fails, comment it out.
RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]