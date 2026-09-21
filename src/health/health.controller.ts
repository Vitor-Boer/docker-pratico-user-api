import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Sem dependência de banco ou hub: serve para saber se o container está de pé.
  @Get()
  check() {
    return { status: 'ok' };
  }
}
