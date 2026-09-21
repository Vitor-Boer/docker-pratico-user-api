# Dockerfile da API do participante (NestJS). Complete as lacunas marcadas com TODO(workshop).

# ---- Estágio 1: build ----
# TODO(workshop): escolha a imagem base do Node (dica: uma tag alpine, ex. node:24-alpine)
FROM ??? AS build
WORKDIR /app

# O pnpm vem pelo corepack, na versão indicada no package.json.
RUN corepack enable

# Copiar só os manifestos primeiro aproveita o cache de camadas: se as dependências
# não mudaram, o install não roda de novo. O prisma/ vai junto porque o install gera o client.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# TODO(workshop): instale as dependências (dica: pnpm install --frozen-lockfile)

COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

# ---- Estágio 2: runtime (imagem final enxuta) ----
# TODO(workshop): use a mesma imagem base do estágio de build
FROM ??? AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
RUN corepack enable

# Só as dependências de produção (sem TypeScript, Jest, Nest CLI...).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=build /app/dist ./dist

# TODO(workshop): documente a porta em que a API escuta (4000)
CMD ["node", "dist/main.js"]
