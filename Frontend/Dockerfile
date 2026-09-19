FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json dev-server.js static-response.js ./
COPY *.html ./
COPY js ./js
COPY logos ./logos

EXPOSE 8080
CMD ["node", "dev-server.js"]