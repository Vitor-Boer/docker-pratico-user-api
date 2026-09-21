import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PrismaService } from './prisma/prisma.service';
import { createFakePrisma, FakePrisma } from './testing/fake-prisma';
import { MockHub } from './testing/mock-hub';

const PARTICIPANT_TOKEN = 'participant-secret';
const DEAD_HUB = 'http://127.0.0.1:1';

describe('API do participante (e2e, banco e hub simulados)', () => {
  let hub: MockHub;
  let prisma: FakePrisma;
  let app: INestApplication;

  async function boot(hubUrl: string) {
    process.env.PARTICIPANT_TOKEN = PARTICIPANT_TOKEN;
    process.env.HUB_URL = hubUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }

  // A API se autentica no hub ao subir, sem bloquear. Espera isso acontecer.
  async function waitForBootstrapAuth() {
    for (let i = 0; i < 50 && hub.callsTo('/auth').length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  beforeEach(async () => {
    hub = new MockHub(PARTICIPANT_TOKEN);
    await hub.start();
    prisma = createFakePrisma();
  });

  afterEach(async () => {
    await app.close();
    await hub.stop();
  });

  const http = () => request(app.getHttpServer());

  describe('com hub e banco no ar', () => {
    beforeEach(async () => {
      await boot(hub.url);
      await waitForBootstrapAuth();
    });

    it('GET /health responde 200', async () => {
      await http().get('/health').expect(200, { status: 'ok' });
    });

    it('autentica no hub ao subir, com o PARTICIPANT_TOKEN', () => {
      const [auth] = hub.callsTo('/auth');
      expect(auth.method).toBe('POST');
      expect(auth.authorization).toBe(`Bearer ${PARTICIPANT_TOKEN}`);
    });

    it('GET /status mostra banco e hub no ar', async () => {
      await http().get('/status').expect(200, { db: 'up', hub: 'up' });
    });

    it('GET /hub/session devolve o token USER e a URL do hub, nunca o PARTICIPANT_TOKEN', async () => {
      const { body } = await http().get('/hub/session').expect(200);

      expect(body).toEqual({ token: expect.stringMatching(/^user-token-/), hubUrl: hub.url });
      expect(JSON.stringify(body)).not.toContain(PARTICIPANT_TOKEN);
    });

    it('GET /profile devolve null até o apelido ser definido', async () => {
      await http().get('/profile').expect(200, { nickname: null });
    });

    it('PUT /profile grava no banco local e faz o check-in DB com o apelido no hub', async () => {
      await http()
        .put('/profile')
        .send({ nickname: '  Vitor  ' })
        .expect(200, { nickname: 'Vitor', synced: true });

      expect(prisma._rows).toHaveLength(1);
      await http().get('/profile').expect(200, { nickname: 'Vitor' });

      const [checkin] = hub.callsTo('/checkins');
      expect(checkin.body).toEqual({ checkpoint: 'DB', nickname: 'Vitor' });
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

    it('POST /sync sem apelido devolve 409', async () => {
      await http().post('/sync').expect(409);
    });

    it('POST /sync reenvia o apelido local ao hub', async () => {
      await http().put('/profile').send({ nickname: 'Vitor' }).expect(200);
      await http().post('/sync').expect(200, { synced: true });

      expect(hub.callsTo('/checkins')).toHaveLength(2);
    });

    it('reautentica e tenta de novo quando o hub responde 401 ao check-in', async () => {
      // Como se o hub tivesse reiniciado e esquecido o token em cache da API.
      hub.validTokens.clear();

      await http()
        .put('/profile')
        .send({ nickname: 'Vitor' })
        .expect(200, { nickname: 'Vitor', synced: true });

      expect(hub.callsTo('/checkins')).toHaveLength(2);
      expect(hub.callsTo('/auth').length).toBeGreaterThanOrEqual(2);
    });

    describe('com o banco fora do ar', () => {
      beforeEach(() => {
        prisma._state.down = true;
      });

      it('GET /status ainda responde 200, com banco down', async () => {
        await http().get('/status').expect(200, { db: 'down', hub: 'up' });
      });

      it('GET /profile e PUT /profile devolvem 503, e nada vai ao hub', async () => {
        await http().get('/profile').expect(503);
        await http().put('/profile').send({ nickname: 'Vitor' }).expect(503);

        expect(hub.callsTo('/checkins')).toHaveLength(0);
      });

      it('volta a funcionar quando o banco sobe', async () => {
        await http().get('/profile').expect(503);
        prisma._state.down = false;

        await http().get('/profile').expect(200, { nickname: null });
      });
    });
  });

  describe('com o hub fora do ar', () => {
    beforeEach(async () => {
      await boot(DEAD_HUB);
    });

    it('a API sobe e responde normalmente', async () => {
      await http().get('/health').expect(200);
    });

    it('GET /status mostra hub down, sem erro', async () => {
      await http().get('/status').expect(200, { db: 'up', hub: 'down' });
    });

    it('GET /hub/session devolve 503', async () => {
      await http().get('/hub/session').expect(503);
    });

    it('PUT /profile grava localmente e avisa que não sincronizou', async () => {
      await http()
        .put('/profile')
        .send({ nickname: 'Vitor' })
        .expect(200, { nickname: 'Vitor', synced: false });

      await http().get('/profile').expect(200, { nickname: 'Vitor' });
    });

    it('POST /sync devolve 502', async () => {
      await http().put('/profile').send({ nickname: 'Vitor' }).expect(200);
      await http().post('/sync').expect(502);
    });
  });

  describe('com PARTICIPANT_TOKEN inválido', () => {
    it('o hub recusa e a API não sincroniza, sem quebrar', async () => {
      process.env.PARTICIPANT_TOKEN = 'errado';
      process.env.HUB_URL = hub.url;
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();
      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();

      await http().get('/hub/session').expect(503);
      await http()
        .put('/profile')
        .send({ nickname: 'Vitor' })
        .expect(200, { nickname: 'Vitor', synced: false });
    });
  });
});
