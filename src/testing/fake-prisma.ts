import { randomUUID } from 'crypto';

// Banco em memória com só o que a API do participante usa. NÃO substitui um teste contra o
// Postgres real.

interface Row {
  id: string;
  nickname: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createFakePrisma() {
  const rows: Row[] = [];
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1) + tick++);

  const state = {
    // Simula o container do banco fora do ar.
    down: false,
    // Simula o banco recriado sem a tabela: a próxima operação falha uma vez com P2021.
    tableMissing: false,
    tableCreations: 0,
  };

  const guard = () => {
    if (state.down) throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  };

  return {
    participant: {
      findFirst: async () => {
        guard();
        if (state.tableMissing) {
          throw Object.assign(new Error('table does not exist'), { code: 'P2021' });
        }
        const first = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        return first ? { ...first } : null;
      },

      create: async ({ data }: { data: { nickname: string } }) => {
        guard();
        if (rows.some((r) => r.nickname === data.nickname)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row: Row = { id: randomUUID(), nickname: data.nickname, createdAt: now(), updatedAt: now() };
        rows.push(row);
        return { ...row };
      },

      update: async ({ where, data }: { where: { id: string }; data: { nickname: string } }) => {
        guard();
        const row = rows.find((r) => r.id === where.id)!;
        row.nickname = data.nickname;
        row.updatedAt = now();
        return { ...row };
      },
    },

    // `SELECT 1` chamado como template literal.
    $queryRaw: async () => {
      guard();
      return [{ '?column?': 1 }];
    },

    $executeRawUnsafe: async () => {
      guard();
      state.tableCreations++;
      state.tableMissing = false;
      return 0;
    },

    _rows: rows,
    _state: state,
  };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
