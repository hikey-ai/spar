FROM oven/bun:1 AS base

WORKDIR /app

# Install ripgrep
RUN apt-get update && apt-get install -y ripgrep && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun build index.ts --outdir dist --target bun --outfile spar

EXPOSE 3000

CMD ["./dist/spar"]