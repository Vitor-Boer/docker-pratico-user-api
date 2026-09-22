import { Controller, Get } from '@nestjs/common';
import { ParticipantStore } from '../profile/participant.store';

type Light = 'up' | 'down';

const TIMEOUT_MS = 2500;

// Rejeita se a operação não terminar a tempo (o banco pode simplesmente não responder).
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Controller('status')
export class StatusController {
  constructor(private readonly store: ParticipantStore) {}

  // Alimenta o indicador do site e, através dele, o bloquinho do banco no painel do hub.
  // Nunca falha por causa do banco fora do ar: é justamente para dizer que ele está fora.
  @Get()
  async get(): Promise<{ db: Light }> {
    const db = await withTimeout(this.store.ping(), TIMEOUT_MS).then(
      (): Light => 'up',
      (): Light => 'down',
    );

    return { db };
  }
}
