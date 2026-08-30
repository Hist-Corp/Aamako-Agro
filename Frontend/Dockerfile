FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json server.js ./
COPY *.html ./
COPY js ./js
COPY logos ./logos

EXPOSE 8080
CMD ["node", "server.js"]