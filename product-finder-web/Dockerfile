# Product Finder web: Angular build served by nginx, which also proxies /api to the API.

# --- build ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# --- runtime ---
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/product-finder-web/browser /usr/share/nginx/html
EXPOSE 80
