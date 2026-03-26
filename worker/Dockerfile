# worker/Dockerfile

# Use a lightweight Node.js image
FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the worker code
COPY . .

# Start the worker process (adjust if your start script is different)
CMD ["npm", "start"]