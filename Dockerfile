# Dead Pixel: a static web app. The container only serves files; it never receives or stores anyone's art.
# Saves and exports happen in the browser and land on the user's own computer.
FROM node:22-alpine AS build
WORKDIR /src
COPY . .
RUN node tools/build.mjs && node tests/run.mjs

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/public /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
