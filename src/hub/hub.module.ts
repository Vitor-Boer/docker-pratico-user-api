import { Module } from '@nestjs/common';
import { HubClient } from './hub.client';
import { HubController } from './hub.controller';

@Module({
  controllers: [HubController],
  providers: [HubClient],
})
export class HubModule {}
