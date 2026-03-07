# Stage 1: Build dependencies
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed (e.g. for bcrypt)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
# Only copy source files to reduce image size
COPY server.js ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY middleware/ ./middleware/

# Expose the API port
EXPOSE 5000

# Use production env by default
ENV NODE_ENV=production

CMD ["node", "server.js"]
