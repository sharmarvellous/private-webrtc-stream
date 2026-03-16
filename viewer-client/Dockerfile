FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "start-viewer", "--", "--host", "0.0.0.0", "--strictPort"]
