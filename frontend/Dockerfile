
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build not strictly necessary for dev, but good practice
# RUN npm run build

CMD ["npm", "run", "dev"]
