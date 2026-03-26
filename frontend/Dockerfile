# frontend/Dockerfile

# ==== STAGE 1: Build the React App ====
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# This creates the optimized static files in the /dist folder
RUN npm run build 

# ==== STAGE 2: Serve with NGINX ====
FROM nginx:alpine
# Remove default config
RUN rm /etc/nginx/conf.d/default.conf
# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy the built files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]