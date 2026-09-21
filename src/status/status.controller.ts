import { Controller, Get } from '@nestjs/common';
import { HubClient } from '../hub/hub.client';
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
  constructor(
    private readonly store: ParticipantStore,
    private readonly hub: HubClient,
  ) {}

  // Alimenta os indicadores do site. Nunca falha por causa de banco ou hub fora do ar:
  // é justamente para dizer que eles estão fora.
  @Get()
  async get(): Promise<{ db: Light; hub: Light }> {
    const [db, hub] = await Promise.all([
      withTimeout(this.store.ping(), TIMEOUT_MS).then(
        (): Light => 'up',
        (): Light => 'down',
      ),
      this.hub.isUp().then((up): Light => (up ? 'up' : 'down')),
    ]);

    return { db, hub };
  }
}
