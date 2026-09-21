import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HubClient } from './hub.client';

@Controller('hub')
export class HubController {
  constructor(private readonly hub: HubClient) {}

  // O site pede o token USER (somente leitura) e chama o hub direto com ele.
  // Nunca devolve o PARTICIPANT_TOKEN.
  @Get('session')
  async session() {
    const session = await this.hub.session();
    if (!session) throw new ServiceUnavailableException('Hub indisponível');
    return session;
  }
}
