import { Body, Controller, Get, Put } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ParticipantStore } from './participant.store';

@Controller()
export class ProfileController {
  constructor(private readonly store: ParticipantStore) {}

  @Get('profile')
  async get() {
    return { nickname: await this.store.getNickname() };
  }

  // Só grava no banco local. Quem leva o apelido até o painel é o site, que lê este
  // endpoint e o repassa no próximo ping ao hub.
  @Put('profile')
  async update(@Body() dto: UpdateProfileDto) {
    return { nickname: await this.store.saveNickname(dto.nickname) };
  }
}
