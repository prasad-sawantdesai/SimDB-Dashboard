# Builder stage: install dependencies and prepare source for downstream stages.
FROM node:24-alpine AS builder
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm clean-install
COPY dashboard/ ./

# Dev stage: run Vite dev server from builder dependencies.
FROM builder AS dev
EXPOSE 5173
CMD ["sh", "-c", "[ -x node_modules/.bin/vite ] || npm ci; npm run dev -- --host 0.0.0.0 --port 5173"]

# Lint stage: run static checks against prepared source and dependencies.
FROM builder AS lint
RUN npm run lint

# Type-check stage: verify Vue/TypeScript without emitting files.
# Keep this separate from lint because eslint does not catch Vue template/type errors.
FROM builder AS type-check
RUN npm run type-check

# Test stage: run unit tests against prepared source and dependencies.
FROM builder AS test
RUN npm run test:unit -- --run

# Build stage: compile production-ready frontend assets.
FROM builder AS build
ARG APP_VERSION=0.0.0-unknown
RUN echo "${APP_VERSION}" > .app-version
RUN npm run build

# Service stage: serve compiled static assets with nginx.
FROM nginx:1.27-alpine AS service
COPY docker/dashboard.nginx /etc/nginx/templates/default.conf.template
# Include the runtime config template in the image so the service image works
# standalone, not only when docker-compose mounts ./docker/runtime-config-template.js.
COPY docker/runtime-config-template.js /usr/share/nginx/html/runtime-config-template.js
# App expects itself at urlpath /dashboard
COPY --from=build /app/dist /usr/share/nginx/html/dashboard
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
