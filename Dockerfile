FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=2567
USER node
EXPOSE 2567
CMD ["npx", "tsx", "server/src/index.ts"]
