import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = '***';
    return parsed.toString();
  } catch {
    return url.replace(/\/\/[^@]+@/, '//***@');
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const pool = new Pool({
      connectionString,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      idleTimeoutMillis: 120000,
      // Curto de propósito: o banco só sobe no checkpoint 3, e a API precisa responder
      // "banco indisponível" rápido enquanto ele não está no ar.
      connectionTimeoutMillis: 3000,
    });

    const adapter = new PrismaPg(pool);
    super({
      adapter,
      log: [{ emit: 'stdout', level: 'error' }],
    });

    this.connectionString = connectionString;
  }

  private readonly connectionString: string;

  // Não conecta na subida: o banco pode ainda não existir (é o checkpoint 3).
  // O pool conecta sob demanda, na primeira consulta.
  onModuleInit() {
    this.logger.log(
      `DATABASE_URL (mascarada): ${maskDatabaseUrl(this.connectionString)}`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
