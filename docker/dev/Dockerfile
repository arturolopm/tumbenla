FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --prefer-offline --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]