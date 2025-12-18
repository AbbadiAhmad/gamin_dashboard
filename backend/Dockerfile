FROM node:18-alpine

# Install MySQL client tools for backup/restore
RUN apk add --no-cache mysql-client

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
