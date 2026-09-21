import { Module } from '@nestjs/common';
import { ParticipantStore } from './participant.store';
import { ProfileController } from './profile.controller';

@Module({
  controllers: [ProfileController],
  providers: [ParticipantStore],
  exports: [ParticipantStore],
})
export class ProfileModule {}
