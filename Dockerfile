# syntax=docker/dockerfile:1

############################
# Builder: compile Spar binary with Bun
############################
FROM oven/bun:1.1 AS builder
WORKDIR /app

# Copy dependency manifests first for caching
COPY bun.lock package.json tsconfig.json index.ts ./
COPY src ./src

RUN bun install

# Build static binary
RUN mkdir -p dist && bun build --compile --minify index.ts --outfile dist/spar

############################
# Runtime: lightweight Node + pnpm environment
############################
FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV WORKSPACE_PATH=/workspace
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm via npm (corepack is not enabled by default in slim image)
RUN npm install -g pnpm@9

# Copy compiled Spar binary
COPY --from=builder /app/dist/spar /usr/local/bin/spar
RUN chmod +x /usr/local/bin/spar

# Prepare workspace
WORKDIR /workspace
VOLUME ["/workspace"]

EXPOSE 3000

ENTRYPOINT ["spar"]
