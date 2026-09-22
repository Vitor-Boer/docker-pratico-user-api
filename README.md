# docker-pratico-user-api

API do workshop **Docker na Prática**. É a segunda peça do desafio: depois de subir o site, você containeriza esta API, liga o banco de dados e, no fim, junta tudo com Docker Compose.

A API guarda o seu apelido no banco local (Postgres), diz ao site se o banco está de pé e busca a lista de participantes do workshop. Enquanto ela não estiver no ar, o seu quadro fica vazio.

## Rodar localmente (sem Docker)

Precisa de um Postgres acessível em `DATABASE_URL`. Se não tiver um, suba um descartável:

```bash
docker run -d --name db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=docker_na_pratica postgres:16
```

Bate com o `DATABASE_URL` padrão do `.env.example`, sem precisar editar nada.

```bash
pnpm install
cp .env.example .env
pnpm run start:dev
```

Escuta na porta 3001. A tabela do banco é criada sozinha na primeira consulta; não há migrations.

Se a porta 5432 já estiver ocupada (outro Postgres instalado na máquina, por exemplo), suba o container numa porta livre e ajuste o host da `DATABASE_URL` no seu `.env`, ex.: `-p 5434:5432` e `localhost:5434`.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /health` | responde 200 se a API está de pé |
| `GET /status` | `{ db }`, `up` ou `down` |
| `GET /profile` | seu apelido (ou `null`) |
| `PUT /profile` | grava o apelido `{ "nickname": "..." }` |
| `GET /participants` | a lista de participantes, buscada no hub do workshop |
| `GET /participants/:id` | um participante |

## Configuração

Copie `.env.example` para `.env`.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | banco local. No container, o host é `db` (o nome do container do banco) |
| `PORT` | padrão 3001 |
| `HUB_URL` | opcional: o hub do workshop já vem como padrão |

Não há token para colar em lugar nenhum.

Se o banco ou o hub estiverem fora do ar, a API continua no ar e avisa o que falta.

## Testes

```bash
pnpm test
```

## Desafio

O `Dockerfile` tem lacunas marcadas com `TODO(workshop)`. Complete-as seguindo as etapas do workshop.

## Docker

Depois de completar o `Dockerfile`:

```bash
docker build -t api .
docker run -d --name api -p 3001:3001 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/docker_na_pratica?schema=public" api
```

`host.docker.internal` é o jeito do Docker Desktop (Windows/Mac) de o container falar com algo publicado no seu host — aqui, o banco abaixo. Em Linux nativo isso não resolve sozinho; adicione `--add-host=host.docker.internal:host-gateway` ao `docker run`. Sobe normal mesmo sem o banco existir ainda: só tenta conectar na primeira consulta, não na subida.

Banco:

```bash
docker run -d --name db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=docker_na_pratica postgres:16
```
