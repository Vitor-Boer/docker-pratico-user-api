# docker-pratico-user-api

API do workshop **Docker na Prática**. É a segunda peça do desafio: depois de subir o site, você containeriza esta API, liga o banco de dados e, no fim, junta tudo com Docker Compose.

A API guarda o seu apelido no banco local (Postgres) e diz ao site se o banco está de pé. Quem leva isso ao painel do workshop é o site.

## Rodar localmente (sem Docker)

Precisa de um Postgres acessível em `DATABASE_URL`.

```bash
pnpm install
cp .env.example .env
pnpm run start:dev
```

Escuta na porta 4000. A tabela do banco é criada sozinha na primeira consulta; não há migrations.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /health` | responde 200 se a API está de pé |
| `GET /status` | `{ db }`, `up` ou `down` |
| `GET /profile` | seu apelido (ou `null`) |
| `PUT /profile` | grava o apelido `{ "nickname": "..." }` |

## Configuração

Copie `.env.example` para `.env`.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | banco local. No container, o host é `db` (o nome do container do banco) |
| `PORT` | padrão 4000 |

Não há token para colar: esta API não fala com nenhum serviço externo.

Se o banco estiver fora do ar, a API continua no ar e avisa o que falta.

## Testes

```bash
pnpm test
```

## Desafio

O `Dockerfile` tem lacunas marcadas com `TODO(workshop)`. Complete-as seguindo as etapas do workshop.
