import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { StatusController } from './status.controller';

@Module({
  imports: [ProfileModule],
  controllers: [StatusController],
})
export class StatusModule {}
