# docker-pratico-user-api

API do workshop **Docker na Prática**. É a segunda peça do desafio: depois de subir o site, você containeriza esta API, liga o banco de dados e, no fim, junta tudo com Docker Compose.

A API guarda o seu apelido no banco local (Postgres) e avisa o hub do workshop do seu progresso.

## Rodar localmente (sem Docker)

Precisa de um Postgres acessível em `DATABASE_URL`.

```bash
pnpm install
cp .env.example .env   # preencha PARTICIPANT_TOKEN e HUB_URL
pnpm run start:dev
```

Escuta na porta 4000. A tabela do banco é criada sozinha na primeira consulta; não há migrations.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /health` | responde 200 se a API está de pé |
| `GET /status` | `{ db, hub }`, cada um `up` ou `down` |
| `GET /hub/session` | `{ token, hubUrl }` para o site consultar o hub |
| `GET /profile` | seu apelido (ou `null`) |
| `PUT /profile` | grava o apelido `{ "nickname": "..." }` e avisa o hub |
| `POST /sync` | reenvia o apelido ao hub |

## Configuração

Copie `.env.example` para `.env`.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | banco local. No container, o host é `db` (o nome do container do banco) |
| `PARTICIPANT_TOKEN` | o token que você recebeu no início do evento |
| `HUB_URL` | endereço do hub, passado pelo apresentador |
| `PORT` | padrão 4000 |

Se o hub ou o banco estiverem fora do ar, a API continua no ar e avisa o que falta.

## Testes

```bash
pnpm test
```

## Desafio

O `Dockerfile` tem lacunas marcadas com `TODO(workshop)`. Complete-as seguindo as etapas do workshop.
