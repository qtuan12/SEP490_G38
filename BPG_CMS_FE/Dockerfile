# Stage 1: Build React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Khai báo biến môi trường tại thời điểm build
ARG VITE_API_URL=/api
ARG VITE_USE_MOCK_API=false

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCK_API=$VITE_USE_MOCK_API

RUN npm run build

# Stage 2: Serve tĩnh bằng Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
