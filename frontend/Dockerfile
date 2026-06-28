# Stage 1: Build the React application
FROM node:22-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the project (creates the dist folder)
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Copy static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config for routing and proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
