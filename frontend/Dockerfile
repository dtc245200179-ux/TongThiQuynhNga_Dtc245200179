FROM node:18-alpine

WORKDIR /app

# Hardening: Chạy container với user non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json ./
RUN npm install

COPY . .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["npm", "run", "dev"]