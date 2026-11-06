// Base de datos en memoria que imita lo que usamos del cliente de Supabase. Solo para tests.
type Row = Record<string, unknown>;
type Op = "select" | "update" | "delete" | "insert";

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: [string, unknown][] = [];
  constructor(private rows: Row[], private op: Op, private payload?: Row) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  order() {
    return this;
  }
  private exec(): Row[] {
    if (this.op === "insert") {
      const row = { ...this.payload };
      this.rows.push(row);
      return [row];
    }
    const matched = this.rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.payload));
    if (this.op === "delete") matched.forEach((r) => this.rows.splice(this.rows.indexOf(r), 1));
    return matched.map((r) => ({ ...r }));
  }
  async maybeSingle() {
    return { data: this.exec()[0] ?? null, error: null };
  }
  async single() {
    const r = this.exec()[0];
    return r ? { data: r, error: null } : { data: null, error: { message: "not found" } };
  }
  then<T1 = { data: unknown; error: null }, T2 = never>(
    ok?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    ko?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve({ data: this.exec(), error: null as null }).then(ok, ko);
  }
}

export function fakeDb(tables: Record<string, Row[]>) {
  const removed: string[] = [];
  const client = {
    from: (t: string) => {
      const rows = (tables[t] ??= []);
      return {
        select: () => new FakeQuery(rows, "select"),
        update: (p: Row) => new FakeQuery(rows, "update", p),
        delete: () => new FakeQuery(rows, "delete"),
        insert: (p: Row) => new FakeQuery(rows, "insert", p),
      };
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })),
          error: null,
        }),
        createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}` }, error: null }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { data: [], error: null };
        },
      }),
    },
  };
  return { client, tables, removed };
}

export function garmentRow(over: Row = {}): Row {
  return {
    id: "g1", user_id: "owner-1", status: "ready", image_path: "owner-1/g1.webp", type: "camisa",
    description: "camisa oxford azul", colors: ["azul"], formality: 3, seasons: ["primavera"], pattern: null,
    material: null, availability: "disponible", suit_pair_id: null, jacket_combinable: false, error: null,
    created_at: "2026-11-06T10:00:00Z", updated_at: "2026-11-06T10:00:00Z",
    ...over,
  };
}
