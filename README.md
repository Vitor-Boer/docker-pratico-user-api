# docker-pratico-user-api

API do workshop **Docker na Prática**. É a segunda peça do desafio: depois de subir o site, você containeriza esta API, liga o banco de dados e, no fim, junta tudo com Docker Compose.

A API guarda o seu apelido no banco local (Postgres), diz ao site se o banco está de pé e busca a lista de participantes do workshop. Enquanto ela não estiver no ar, o seu quadro mostra só você e o hub — os outros participantes não aparecem.

## Instalar Docker e Git (Linux)

No Windows e no Mac, instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e o [Git](https://git-scm.com/downloads). No Linux, pelo terminal:

Docker (Engine + Compose, pelo script oficial; funciona em Ubuntu, Debian, Fedora e derivados):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

O `usermod` libera o `docker` sem `sudo`. Só vale depois de sair e entrar de novo na sessão (ou rodar `newgrp docker` no terminal atual). Confira com `docker run hello-world`.

Git:

```bash
sudo apt install -y git   # Ubuntu/Debian
sudo dnf install -y git   # Fedora
```

Baixar este repositório:

```bash
git clone https://github.com/Vitor-Boer/docker-pratico-user-api.git
cd docker-pratico-user-api
```

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

A resposta está em `Dockerfile.gabarito` — se quiser tentar sozinho antes, não abra. Para buildar direto com ela: `docker build -f Dockerfile.gabarito -t api .`

## Docker

Depois de completar o `Dockerfile`:

```bash
docker build -t api .
```

Há dois jeitos de a API em container alcançar o banco. Use o primeiro; o segundo fica como alternativa.

Se você subiu o banco descartável de [Rodar localmente](#rodar-localmente-sem-docker), ele já ocupa o nome `db`. Remova antes (`docker rm -f db`) — os dados de teste vão junto.

### Opção 1: rede Docker (recomendada)

A rede `workshop` normalmente já foi criada no passo do site (`docker-pratico-web`). Se não, crie uma vez com `docker network create workshop` (dá erro se já existir, sem problema).

```bash
docker run -d --name api --network workshop -p 3001:3001 -e DATABASE_URL="postgresql://postgres:postgres@db:5432/docker_na_pratica?schema=public" api
```

`db` só resolve por nome porque a API está na mesma rede do banco — é o Docker cuidando do DNS entre containers sozinho. Enquanto o banco não existir, a API fica de pé e responde banco `down`.

Banco:

```bash
docker run -d --name db --network workshop \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=docker_na_pratica postgres:16
```

O banco não publica porta (`-p`): só a API, que já está na mesma rede, precisa alcançá-lo.

### Opção 2: `host.docker.internal`

Aqui o banco publica a porta no seu computador e a API sai do container para alcançá-lo pelo host, sem rede compartilhada.

Windows e Mac (Docker Desktop), onde `host.docker.internal` já resolve sozinho:

```bash
docker run -d --name api -p 3001:3001 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/docker_na_pratica?schema=public" api
```

Linux (Docker Engine nativo), onde é preciso criar o nome com `--add-host` — é uma flag do `docker run`, não do `docker build`:

```bash
docker run -d --name api -p 3001:3001 \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/docker_na_pratica?schema=public" api
```

Banco, com a porta publicada:

```bash
docker run -d --name db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=docker_na_pratica postgres:16
```

No Linux, um firewall no host (ufw, firewalld) pode bloquear o tráfego do container até a porta publicada, e a API fica com o banco `down`. Se acontecer, use a opção 1.

Nas duas opções a API sobe normal mesmo sem o banco existir ainda: só tenta conectar na primeira consulta, não na subida.

## Comandos úteis (debug)

| Comando | Para quê |
|---|---|
| `docker ps` | containers rodando agora |
| `docker ps -a` | todos, inclusive os que pararam ou caíram (veja a coluna `STATUS`) |
| `docker logs api` | saída da API — primeiro lugar para olhar quando algo não sobe |
| `docker logs -f api` | acompanha os logs ao vivo (`Ctrl+C` sai) |
| `docker stop api` | para o container |
| `docker start api` | sobe de novo um container parado, com a mesma configuração |
| `docker rm api` | remove um container parado |
| `docker rm -f api` | para e remove de uma vez |
| `docker exec -it api sh` | abre um terminal dentro do container (`exit` sai) |
| `docker images` | imagens construídas/baixadas |
| `docker network inspect workshop` | quem está conectado na rede `workshop` |

Troque `api` por `db` para o banco. Erros comuns:

- **`Conflict. The container name "/api" is already in use`**: já existe um container com esse nome, mesmo parado. `docker rm -f api` e rode de novo.
- **`port is already allocated`**: outra coisa já usa a porta (um container antigo ou a API rodando fora do Docker). Ache com `docker ps` e remova, ou pare o processo local.
- **Mudou o código ou o `Dockerfile` e nada mudou**: o container usa a imagem antiga. Rode `docker build -t api .` de novo, `docker rm -f api` e suba outra vez.
- **API no ar mas banco `down`**: `docker ps -a` para ver se o `db` está rodando, e `docker network inspect workshop` para ver se `api` e `db` estão na mesma rede.
