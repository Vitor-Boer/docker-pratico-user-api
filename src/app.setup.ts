import { INestApplication, ValidationPipe } from '@nestjs/common';

// Configuração compartilhada entre a aplicação e os testes e2e.
export function configureApp(app: INestApplication) {
  // CORS livre: demonstração, sem restrição de origem.
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
