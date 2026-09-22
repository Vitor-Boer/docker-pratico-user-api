import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PrismaService } from './prisma/prisma.service';
import { createFakePrisma, FakePrisma } from './testing/fake-prisma';

describe('API do participante (e2e, banco simulado)', () => {
  let prisma: FakePrisma;
  let app: INestApplication;

  beforeEach(async () => {
    prisma = createFakePrisma();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  const http = () => request(app.getHttpServer());

  it('GET /health responde 200', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
  });

  it('GET /status mostra o banco no ar', async () => {
    await http().get('/status').expect(200, { db: 'up' });
  });

  it('GET /profile devolve null até o apelido ser definido', async () => {
    await http().get('/profile').expect(200, { nickname: null });
  });

  it('PUT /profile grava o apelido no banco local', async () => {
    await http().put('/profile').send({ nickname: '  Vitor  ' }).expect(200, { nickname: 'Vitor' });

    expect(prisma._rows).toHaveLength(1);
    await http().get('/profile').expect(200, { nickname: 'Vitor' });
  });

  it('PUT /profile de novo atualiza o mesmo registro, sem criar outro', async () => {
    await http().put('/profile').send({ nickname: 'Vitor' }).expect(200);
    await http().put('/profile').send({ nickname: 'Vitor B' }).expect(200);

    expect(prisma._rows).toHaveLength(1);
    await http().get('/profile').expect(200, { nickname: 'Vitor B' });
  });

  it('PUT /profile valida o corpo (400)', async () => {
    await http().put('/profile').send({}).expect(400);
    await http().put('/profile').send({ nickname: '   ' }).expect(400);
    await http().put('/profile').send({ nickname: 'x'.repeat(41) }).expect(400);
  });

  it('cria a tabela na primeira consulta, uma só vez', async () => {
    await http().get('/profile').expect(200);
    await http().get('/profile').expect(200);
    await http().get('/status').expect(200);

    expect(prisma._state.tableCreations).toBe(1);
  });

  it('recria a tabela se o banco foi recriado com a API no ar', async () => {
    await http().get('/profile').expect(200);
    prisma._state.tableMissing = true;

    await http().get('/profile').expect(200, { nickname: null });
    expect(prisma._state.tableCreations).toBe(2);
  });

  describe('com o banco fora do ar', () => {
    beforeEach(() => {
      prisma._state.down = true;
    });

    it('GET /status ainda responde 200, com banco down', async () => {
      await http().get('/status').expect(200, { db: 'down' });
    });

    it('GET /profile e PUT /profile devolvem 503', async () => {
      await http().get('/profile').expect(503);
      await http().put('/profile').send({ nickname: 'Vitor' }).expect(503);
    });

    it('volta a funcionar quando o banco sobe', async () => {
      await http().get('/profile').expect(503);
      prisma._state.down = false;

      await http().get('/profile').expect(200, { nickname: null });
    });
  });
});
