import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Acesso ao banco local. Sem migrations: a tabela é criada aqui, na primeira consulta bem
// sucedida. Isso resolve o caso do workshop em que a API sobe ANTES do banco (checkpoint 2)
// e o banco só aparece depois (checkpoint 3): quando ele responde, a tabela nasce sozinha.
// Este DDL precisa acompanhar o model Participant de prisma/schema.prisma.
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS "participants" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "participants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "participants_nickname_key" UNIQUE ("nickname")
  )`;

@Injectable()
export class ParticipantStore {
  private readonly logger = new Logger(ParticipantStore.name);
  private tableReady = false;

  constructor(private readonly prisma: PrismaService) {}

  // O participante só tem um perfil; o primeiro registro é o dele.
  async getNickname(): Promise<string | null> {
    return this.run(async () => {
      const row = await this.prisma.participant.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      return row?.nickname ?? null;
    });
  }

  async saveNickname(nickname: string): Promise<string> {
    return this.run(async () => {
      const row = await this.prisma.participant.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      const saved = row
        ? await this.prisma.participant.update({ where: { id: row.id }, data: { nickname } })
        : await this.prisma.participant.create({ data: { nickname } });

      return saved.nickname;
    });
  }

  // Responde se o banco está de pé (e garante a tabela).
  async ping(): Promise<void> {
    await this.run(() => this.prisma.$queryRaw`SELECT 1`);
  }

  private async ensureTable() {
    if (this.tableReady) return;
    await this.prisma.$executeRawUnsafe(CREATE_TABLE);
    this.tableReady = true;
  }

  // Traduz falhas do banco em respostas HTTP claras. Se a tabela sumiu (banco recriado
  // com a API ainda no ar), recria e tenta de novo uma vez.
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    for (const attempt of [1, 2]) {
      try {
        await this.ensureTable();
        return await operation();
      } catch (error) {
        const code = (error as { code?: string }).code;

        if (code === 'P2021' && attempt === 1) {
          this.tableReady = false;
          continue;
        }
        if (code === 'P2002') throw new ConflictException('Apelido já em uso');

        // Erros de conexão do driver às vezes vêm sem mensagem; o nome/código ainda ajuda.
        const message =
          error instanceof Error ? error.message || error.name || code || 'sem detalhes' : String(error);
        this.logger.warn(`Banco indisponível: ${message}`);
        throw new ServiceUnavailableException('Banco indisponível');
      }
    }
    throw new ServiceUnavailableException('Banco indisponível');
  }
}
