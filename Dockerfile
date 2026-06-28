# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL=https://api.example.com
ARG VITE_ENABLE_MOCK=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_MOCK=$VITE_ENABLE_MOCK
RUN pnpm build

# Runtime stage — unprivileged variant so nginx can drop root and still bind.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O- http://localhost:8080/healthz || exit 1