import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HubClient } from './hub.client';

interface ParticipantView {
  id: string;
  name: string;
  site: boolean;
  api: boolean;
  db: boolean;
}

// O site lê a sala por aqui. Com esta API fora do ar, o quadro do participante fica vazio
// — é o que dá sentido à etapa 2 do workshop.
@Controller('participants')
export class HubController {
  constructor(private readonly hub: HubClient) {}

  @Get()
  async list(): Promise<ParticipantView[]> {
    const participants = await this.hub.get<ParticipantView[]>('/participants');
    if (!participants) throw new ServiceUnavailableException('Hub indisponível');
    return participants;
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ParticipantView> {
    const participant = await this.hub.get<ParticipantView>(
      `/participants/${encodeURIComponent(id)}`,
    );
    // O hub devolve 404 para quem não existe, e o cliente traduz isso em null junto com
    // "hub fora do ar". Aqui os dois viram 404: para o site, dá no mesmo.
    if (!participant) throw new NotFoundException('Participante não encontrado');
    return participant;
  }
}
