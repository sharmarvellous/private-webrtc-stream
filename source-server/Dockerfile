FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY ui/package.json ui/package-lock.json* ./ui/
RUN cd ui && npm install

COPY . .

RUN npm --prefix ui run build

EXPOSE 5000

CMD ["npm", "run", "start-source"]
