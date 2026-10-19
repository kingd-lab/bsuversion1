FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js source.js start.js ./
USER node
EXPOSE 8080
CMD ["node","start.js"]
