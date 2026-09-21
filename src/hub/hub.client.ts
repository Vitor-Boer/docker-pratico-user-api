import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Checkpoint = 'SITE' | 'API' | 'DB';

const TIMEOUT_MS = 3000;

// Cliente do hub central (projeto separado, do apresentador).
// Nenhum método lança exceção: se o hub cair, a API do participante continua no ar.
@Injectable()
export class HubClient implements OnApplicationBootstrap {
  private readonly logger = new Logger(HubClient.name);
  // Token USER em memória, reaproveitado entre check-ins.
  private token: string | null = null;

  constructor(private readonly config: ConfigService) {}

  get hubUrl(): string | null {
    const url = this.config.get<string>('HUB_URL')?.trim().replace(/\/+$/, '');
    return url || null;
  }

  // Ao subir, a API se autentica no hub. Isso registra o checkpoint da API (o hub
  // marca SITE e API no login). Não bloqueia a subida.
  onApplicationBootstrap() {
    void this.authenticate();
  }

  // POST /auth com o PARTICIPANT_TOKEN. Devolve o token USER, ou null se não deu.
  // O hub responde igual a cada chamada, então repetir é seguro.
  async authenticate(): Promise<string | null> {
    const participantToken = this.config.get<string>('PARTICIPANT_TOKEN');
    if (!participantToken) {
      this.logger.warn('PARTICIPANT_TOKEN não definido: sem integração com o hub');
      return null;
    }

    const response = await this.call('/auth', {
      method: 'POST',
      headers: { Authorization: `Bearer ${participantToken}` },
    });

    if (!response?.ok) {
      if (response) this.logger.warn(`Hub recusou a autenticação (${response.status})`);
      this.token = null;
      return null;
    }

    const body = (await response.json()) as { token?: string };
    this.token = body.token ?? null;
    if (this.token) this.logger.log('Autenticado no hub');
    return this.token;
  }

  // Sempre autentica de novo: o site chama isto ao receber 401 do hub, e devolver o
  // token em cache repetiria o token inválido.
  async session(): Promise<{ token: string; hubUrl: string } | null> {
    const token = await this.authenticate();
    const hubUrl = this.hubUrl;
    return token && hubUrl ? { token, hubUrl } : null;
  }

  // POST /checkins. Se o token expirou ou o hub foi reiniciado (401), autentica e tenta uma vez.
  async checkIn(checkpoint: Checkpoint, nickname?: string): Promise<boolean> {
    for (const attempt of [1, 2]) {
      const token = this.token ?? (await this.authenticate());
      if (!token) return false;

      const response = await this.call('/checkins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nickname ? { checkpoint, nickname } : { checkpoint }),
      });

      if (response?.ok) return true;
      if (response?.status === 401 && attempt === 1) {
        this.token = null;
        continue;
      }

      if (response) this.logger.warn(`Check-in ${checkpoint} recusado pelo hub (${response.status})`);
      return false;
    }
    return false;
  }

  // GET /health do hub, para o indicador de status do site.
  async isUp(): Promise<boolean> {
    const response = await this.call('/health');
    return !!response?.ok;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response | null> {
    const base = this.hubUrl;
    if (!base) {
      this.logger.warn('HUB_URL não definida');
      return null;
    }

    try {
      return await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hub inacessível em ${base}${path}: ${message}`);
      return null;
    }
  }
}
