import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Hub do apresentador. O padrão é o hub oficial do workshop; HUB_URL só é necessária para
// apontar para outro. O participante não configura nada.
const DEFAULT_HUB_URL = 'https://prod-docker-pratico.gljr8e.easypanel.host';

const TIMEOUT_MS = 3000;

// Cliente de leitura do hub. É de propósito que a listagem dos participantes passe por
// aqui, e não direto do navegador: assim ver a sala depende da API local estar no ar, que
// é a etapa 2 do workshop. O ping que acende os bloquinhos continua saindo do navegador.
//
// Nenhum método lança: se o hub cair, quem chama decide o que responder.
@Injectable()
export class HubClient {
  private readonly logger = new Logger(HubClient.name);

  constructor(private readonly config: ConfigService) {}

  get hubUrl(): string {
    const configured = this.config.get<string>('HUB_URL')?.trim().replace(/\/+$/, '');
    return configured || DEFAULT_HUB_URL;
  }

  async get<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.hubUrl}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Hub respondeu ${response.status} em ${path}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hub inacessível em ${this.hubUrl}${path}: ${message}`);
      return null;
    }
  }
}
