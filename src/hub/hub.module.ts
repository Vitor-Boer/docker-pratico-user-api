import { Global, Module } from '@nestjs/common';
import { HubClient } from './hub.client';
import { HubController } from './hub.controller';

@Global()
@Module({
  controllers: [HubController],
  providers: [HubClient],
  exports: [HubClient],
})
export class HubModule {}
