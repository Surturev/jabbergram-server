FROM node:18-alpine

RUN apk add --no-cache libatomic1

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
