# backend/Dockerfile

# Use a lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first (to leverage Docker cache for faster rebuilds)
COPY package*.json ./

# Install dependencies (use ci for clean install if you have a package-lock.json)
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose the port your Express API runs on (change if yours is different)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]