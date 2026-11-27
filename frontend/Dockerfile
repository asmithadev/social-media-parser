FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG VITE_USE_DEMO_DATA=false
ARG VITE_API_BASE_URL=/api
ENV VITE_USE_DEMO_DATA=${VITE_USE_DEMO_DATA} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
