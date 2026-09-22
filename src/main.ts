import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);

  configureApp(app);

  // 0.0.0.0: dentro do container, "localhost" não é alcançável de fora dele.
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ouvindo na porta ${port}`);
}

bootstrap();
