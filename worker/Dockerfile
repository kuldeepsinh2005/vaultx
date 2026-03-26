# Use a slim version of Node.js
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# Copying package files separately optimizes Docker's cache
COPY package*.json ./

# Install only production dependencies to save space
RUN npm install --production

# Bundle app source
COPY . .

# The worker usually doesn't need an EXPOSE port unless it has a health-check API
# CMD to run your worker
CMD ["node", "index.js"]