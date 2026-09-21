import {
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { HubClient } from '../hub/hub.client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ParticipantStore } from './participant.store';

@Controller()
export class ProfileController {
  constructor(
    private readonly store: ParticipantStore,
    private readonly hub: HubClient,
  ) {}

  @Get('profile')
  async get() {
    return { nickname: await this.store.getNickname() };
  }

  // Grava no banco local e avisa o hub (checkpoint 3). A escrita local é a prova do pipeline
  // ponta a ponta; se o hub estiver fora do ar ela continua valendo, e `synced: false`
  // indica que falta sincronizar (POST /sync).
  @Put('profile')
  async update(@Body() dto: UpdateProfileDto) {
    const nickname = await this.store.saveNickname(dto.nickname);
    const synced = await this.hub.checkIn('DB', nickname);
    return { nickname, synced };
  }

  // Reenvia ao hub o apelido que já está no banco local.
  @Post('sync')
  @HttpCode(200)
  async sync() {
    const nickname = await this.store.getNickname();
    if (!nickname) throw new ConflictException('Defina o apelido antes de sincronizar');

    if (!(await this.hub.checkIn('DB', nickname))) {
      throw new BadGatewayException('Hub indisponível');
    }
    return { synced: true };
  }
}
