# Viste-t · Plan 1 de 4: Base + Armario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web instalable (PWA) con código de acceso, barra inferior y sección **Armario** completa: carga por lotes de fotos, quitar fondo, ficha automática con Claude Haiku 5.5, revisión y edición, guardado en Supabase y tope de gasto.

**Architecture:** Frontend Vite + React + TypeScript (PWA). Funciones de Vercel en `api/` con handlers estándar `Request → Response`. Son las únicas que conocen la clave de Claude y la service key de Supabase, y comprueban el código de acceso en cada llamada. Las fotos van del móvil a Supabase Storage mediante URL firmada de subida (para no pasar por el límite de tamaño de Vercel). La cola de carga vive en IndexedDB para retomarse al reabrir la app.

**Tech Stack:** Vite, React 18, TypeScript, vite-plugin-pwa, Vitest + @testing-library/react + jsdom, zod, idb-keyval, @imgly/background-removal, @supabase/supabase-js (solo servidor), @anthropic-ai/sdk (solo servidor), Vercel Functions (Node).

> **Licencia:** `@imgly/background-removal` es AGPL-3.0: se puede usar gratis, pero obliga a que el código de la app sea público (repositorio de GitHub público). Si Alejandro prefiere un repositorio privado, hay que sustituirlo por una alternativa con licencia permisiva antes de la Task 6.

**Spec:** `docs/superpowers/specs/2026-11-06-viste-t-design.md`

**Hoja de ruta (planes siguientes, uno por subsistema):**
1. **Base + Armario** ← este plan
2. Conjuntos: Inicio, generación, resultado en collage, candados, feedback y aprendizaje, tiempo
3. Estilo: capturas de referencia, perfil de estilo editable, referencias por estilo
4. Tienda: foto en tienda, 2–3 conjuntos, veredicto de compra, "La he comprado"

## Global Constraints

- Interfaz **en español**. Móvil primero (se usa con una mano, ancho 360–430 px).
- La clave de Claude (`ANTHROPIC_API_KEY`) y `SUPABASE_SERVICE_ROLE_KEY` **nunca** llegan al navegador. El navegador no importa `@supabase/supabase-js` ni `@anthropic-ai/sdk`.
- Todas las funciones de `api/` sin excepción exigen la cabecera `x-access-code` igual a `ACCESS_CODE`. Si falta o no coincide → `401 {"error":"unauthorized"}`.
- Modelo por tarea configurable por variable de entorno. Por defecto `claude-haiku-5-5` (`MODEL_TAGGING`).
- Tope de gasto mensual `MONTHLY_BUDGET_USD`, por defecto `5`. Si se supera → `402 {"error":"budget_exceeded"}` y no se llama a Claude.
- Todas las tablas llevan `user_id` (en v1, el valor fijo `OWNER_USER_ID`).
- Fotos comprimidas en el móvil a lado máximo **1024 px** antes de quitar fondo y subir.
- Disponibilidad de prenda: `disponible` · `lavanderia` · `guardada`.
- Trajes: chaqueta y pantalón vinculados (`suit_pair_id`). La chaqueta tiene `jacket_combinable` (por defecto `false`).
- Comprobar `stop_reason` de cada respuesta de Claude antes de leer el contenido (Haiku 5.5 puede devolver `refusal` y no tiene fallback del servidor).

## Review Focus

1. **App cerrada a mitad de un lote** → al reabrir se retoma sin crear prendas duplicadas (el `garmentId` se guarda en la cola antes de subir). Test en Task 7.
2. **Tope de gasto alcanzado a mitad de lote** → la cola se pausa con aviso "Has llegado al tope de gasto del mes" y las fotos pendientes se conservan. Tests en Task 4 y Task 7.
3. **Claude rechaza o devuelve algo inválido** (foto que no es ropa, `refusal`, JSON que no valida) → la prenda queda en `error` con "Reintentar" y edición manual, y el resto del lote sigue. Tests en Task 5 y Task 7.
4. **Foto que no se puede decodificar** (formato raro, archivo corrupto) → ese elemento pasa a `error` y el resto del lote sigue. Test en Task 6.
5. **Código de acceso ausente o cambiado** → `401` → vuelve la pantalla de código y la cola se pausa (no marca los elementos como error). Tests en Task 2 y Task 7.

---

### Task 1: Esqueleto de la PWA y barra inferior

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.setup.ts`, `index.html`, `.gitignore`, `.env.example`, `vercel.json`
- Create: `src/main.tsx`, `src/App.tsx`, `src/ui/BottomNav.tsx`, `src/styles.css`
- Create: `src/screens/InicioScreen.tsx`, `src/screens/TiendaScreen.tsx`, `src/screens/EstiloScreen.tsx` (marcadores "Próximamente")
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Test: `src/ui/BottomNav.test.tsx`

**Interfaces:**
- Produces: `type Tab = "armario" | "inicio" | "tienda" | "estilo"`; `<BottomNav active: Tab; onChange(tab: Tab): void />`; `App` abre en `"inicio"`.

- [ ] **Step 1:** `git init`, crear el proyecto Vite React-TS en la raíz e instalar dependencias de desarrollo (vitest, @testing-library/react, @testing-library/jest-dom, jsdom, vite-plugin-pwa). `.gitignore` incluye `node_modules`, `dist`, `.env*` (excepto `.env.example`), `.superpowers/` y `.vercel`.
- [ ] **Step 2: Write the failing test** `BottomNav.test.tsx`:

```tsx
test("muestra las 4 pestañas en orden y marca la activa", () => {
  render(<BottomNav active="inicio" onChange={() => {}} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels.map((l) => l?.replace(/\W/g, ""))).toEqual(["Armario", "Inicio", "Tienda", "Estilo"]);
  expect(screen.getByRole("button", { name: /Inicio/ })).toHaveAttribute("aria-current", "page");
});
test("llama a onChange con la pestaña pulsada", async () => {
  const onChange = vi.fn();
  render(<BottomNav active="inicio" onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: /Armario/ }));
  expect(onChange).toHaveBeenCalledWith("armario");
});
```

- [ ] **Step 3:** Run `npx vitest run src/ui/BottomNav.test.tsx` → FAIL (módulo no existe).
- [ ] **Step 4:** Implementar `BottomNav` (iconos 👕 🏠 📷 ✨, fija abajo, respeta `env(safe-area-inset-bottom)`) y `App` con estado de pestaña. Configurar `vite-plugin-pwa`: `name: "Viste-t"`, `short_name: "Viste-t"`, `lang: "es"`, `display: "standalone"`, `theme_color: "#1f2a24"`, `background_color: "#faf8f5"` (colores del boceto aprobado).
- [ ] **Step 5:** Run `npx vitest run` → PASS. Run `npm run build` → sin errores.
- [ ] **Step 6: Commit** `feat: esqueleto PWA con barra inferior`

---

### Task 2: Código de acceso (servidor y pantalla)

**Files:**
- Create: `server/http.ts`, `server/access.ts`, `api/auth/check.ts`
- Create: `src/lib/api.ts`, `src/ui/AccessGate.tsx`
- Modify: `src/App.tsx` (envolver en `AccessGate`)
- Test: `server/access.test.ts`, `src/lib/api.test.ts`, `src/ui/AccessGate.test.tsx`

**Interfaces:**
- Produces (servidor): `json(status: number, body: unknown): Response`; `requireAccess(req: Request): Response | null` (devuelve un `401` o `null` si es válido; comparación en tiempo constante con `crypto.timingSafeEqual`); `api/auth/check.ts` exporta `GET(req: Request): Response` → `200 {"ok":true}` o `401`.
- Produces (cliente): `getAccessCode(): string | null`, `setAccessCode(code: string): void`, `clearAccessCode(): void` (localStorage `vistet.accessCode`, con try/catch); `class UnauthorizedError extends Error`, `class BudgetExceededError extends Error`; `apiFetch(path: string, init?: RequestInit): Promise<Response>`, que añade `x-access-code`, ante `401` llama a `clearAccessCode()`, emite el evento `window` `"vistet:unauthorized"` y lanza `UnauthorizedError`; ante `402` lanza `BudgetExceededError`.

- [ ] **Step 1: Write the failing tests**

```ts
// server/access.test.ts
beforeEach(() => { process.env.ACCESS_CODE = "armario123"; });
test("sin cabecera → 401", async () => {
  const r = requireAccess(new Request("http://x/api"));
  expect(r?.status).toBe(401);
  expect(await r?.json()).toEqual({ error: "unauthorized" });
});
test("código incorrecto (otra longitud) → 401", () => {
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "no" } }))?.status).toBe(401);
});
test("código correcto → null", () => {
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "armario123" } }))).toBeNull();
});
// src/lib/api.test.ts
test("401 borra el código, emite vistet:unauthorized y lanza UnauthorizedError", async () => { /* fetch mock → 401 */ });
test("402 lanza BudgetExceededError", async () => { /* fetch mock → 402 */ });
// src/ui/AccessGate.test.tsx
test("sin código muestra el formulario; con código válido muestra la app", async () => { /* fetch /api/auth/check → 200 */ });
test("código inválido muestra 'Código incorrecto'", async () => { /* → 401 */ });
test("el evento vistet:unauthorized vuelve a mostrar el formulario", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run server/access.test.ts src/lib/api.test.ts src/ui/AccessGate.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar. La pantalla dice "Introduce tu código de acceso" con un único campo y el botón "Entrar".
- [ ] **Step 4:** Run the same command → PASS.
- [ ] **Step 5: Commit** `feat: código de acceso`

---

### Task 3: Base de datos, almacenamiento y modelo de prenda

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `shared/garment.ts`, `server/supabase.ts`, `server/garmentsRepo.ts`
- Test: `shared/garment.test.ts`, `server/garmentsRepo.test.ts`

**Interfaces:**
- Produces (`shared/garment.ts`):
  - `GARMENT_TYPES = ["camiseta","camisa","polo","jersey","sudadera","sobrecamisa","pantalon_vaquero","pantalon_chino","pantalon_traje","pantalon_otro","bermuda","abrigo","cazadora","americana","chaqueta_traje","calzado","complemento"] as const`, `type GarmentType`
  - `type Layer = "top"|"mid"|"bottom"|"outer"|"shoes"|"accessory"`; `layerOf(t: GarmentType): Layer`
  - `SEASONS = ["primavera","verano","otono","invierno"] as const`; `AVAILABILITY = ["disponible","lavanderia","guardada"] as const`; `GARMENT_STATUS = ["pending","ready","error"] as const`
  - `interface Garment { id: string; status: GarmentStatus; type: GarmentType | null; description: string | null; colors: string[]; formality: number | null /*1–5*/; seasons: Season[]; pattern: string | null; material: string | null; availability: Availability; suitPairId: string | null; jacketCombinable: boolean; error: string | null; imageUrl?: string; createdAt: string }`
  - `GarmentPatchSchema` (zod): campos editables opcionales (`type, description, colors, formality, seasons, pattern, material, availability, suitPairId, jacketCombinable`).
- Produces (`server/supabase.ts`): `db(): SupabaseClient` (singleton con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`); `ownerId(): string` (`OWNER_USER_ID`); `BUCKET = "garments"`.
- Produces (`server/garmentsRepo.ts`): `rowToGarment(row): Garment` y `garmentPatchToRow(p): Record<string, unknown>` (snake_case ↔ camelCase).

- [ ] **Step 1:** Escribir `0001_init.sql`:
  - tabla `garments` (`id uuid pk default gen_random_uuid()`, `user_id uuid not null`, `status text not null default 'pending'`, `image_path text`, `type text`, `description text`, `colors text[] not null default '{}'`, `formality smallint check (formality between 1 and 5)`, `seasons text[] not null default '{}'`, `pattern text`, `material text`, `availability text not null default 'disponible'`, `suit_pair_id uuid references garments(id) on delete set null`, `jacket_combinable boolean not null default false`, `error text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`), con índice en `(user_id, status)`;
  - tabla `usage_ledger` (`id`, `user_id`, `task text`, `model text`, `input_tokens int`, `output_tokens int`, `cache_read_tokens int`, `cache_write_tokens int`, `cost_usd numeric(10,6)`, `created_at timestamptz default now()`), con índice en `(user_id, created_at)`;
  - bucket privado `garments` (`insert into storage.buckets (id, name, public) values ('garments','garments', false)`);
  - RLS activado en ambas tablas sin políticas (solo accede la service key).
- [ ] **Step 2: Write the failing tests**

```ts
test("layerOf clasifica cada tipo", () => {
  expect(layerOf("camisa")).toBe("top");
  expect(layerOf("jersey")).toBe("mid");
  expect(layerOf("pantalon_chino")).toBe("bottom");
  expect(layerOf("chaqueta_traje")).toBe("outer");
  expect(layerOf("calzado")).toBe("shoes");
  expect(layerOf("complemento")).toBe("accessory");
});
test("todos los GARMENT_TYPES tienen capa", () => {
  for (const t of GARMENT_TYPES) expect(layerOf(t)).toBeTruthy();
});
test("GarmentPatchSchema rechaza formality 6 y availability desconocida", () => {
  expect(GarmentPatchSchema.safeParse({ formality: 6 }).success).toBe(false);
  expect(GarmentPatchSchema.safeParse({ availability: "prestada" }).success).toBe(false);
});
test("rowToGarment ↔ garmentPatchToRow mapean snake_case", () => {
  expect(garmentPatchToRow({ suitPairId: "a", jacketCombinable: true })).toEqual({ suit_pair_id: "a", jacket_combinable: true });
});
```

- [ ] **Step 3:** Run `npx vitest run shared server/garmentsRepo.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 4: Commit** `feat: esquema de base de datos y modelo de prenda`

---

### Task 4: Cliente de Claude, coste y tope de gasto

**Files:**
- Create: `server/claude.ts`, `server/budget.ts`
- Test: `server/budget.test.ts`, `server/claude.test.ts`

**Interfaces:**
- Produces (`server/claude.ts`): `anthropic(): Anthropic` (singleton); `type Task = "tagging"` (los siguientes planes añaden `"outfit" | "shop" | "style"`); `modelFor(task: Task): string` (lee `MODEL_TAGGING`, por defecto `"claude-haiku-5-5"`).
- Produces (`server/budget.ts`):
  - `PRICES: Record<string, { in: number; out: number }>` en $/millón de tokens: `claude-haiku-5-5 {0.10, 0.50}`, `claude-sonnet-5-5 {2, 10}`, `claude-opus-5-5 {4, 20}`.
  - `costUsd(model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number`. Escritura en caché = 1,25 × precio de entrada; lectura = 0,1 × precio de entrada. Si el modelo no está en la tabla, se aplica el precio de Opus (sobrestimar es más seguro).
  - `monthStartUtc(now: Date): Date`
  - `getMonthSpend(now?: Date): Promise<number>` (suma `cost_usd` de `usage_ledger` del propietario desde `monthStartUtc`).
  - `budgetUsd(): number` (`MONTHLY_BUDGET_USD`, por defecto `5`).
  - `checkBudget(): Promise<Response | null>` → `402 {"error":"budget_exceeded"}` si `getMonthSpend() >= budgetUsd()`, si no `null`.
  - `recordUsage(task: Task, model: string, usage): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```ts
test("costUsd Haiku: 1M de entrada + 1M de salida = 0,60 $", () => {
  expect(costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
});
test("costUsd aplica 0,1× a lectura de caché y 1,25× a escritura", () => {
  expect(costUsd("claude-haiku-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(0.01 + 0.125);
});
test("modelo desconocido → precio de Opus", () => {
  expect(costUsd("x", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(4);
});
test("monthStartUtc(2026-11-06T10:00Z) = 2026-11-01T00:00Z", () => {
  expect(monthStartUtc(new Date("2026-11-06T10:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
});
test("checkBudget devuelve 402 cuando el gasto del mes iguala el tope", async () => { /* mock getMonthSpend → 5, MONTHLY_BUDGET_USD=5 */ });
test("modelFor('tagging') usa MODEL_TAGGING o claude-haiku-5-5", () => {});
```

- [ ] **Step 2:** Run `npx vitest run server/budget.test.ts server/claude.test.ts` → FAIL. Implementar (mock de `db()` con `vi.mock`). Run → PASS.
- [ ] **Step 3: Commit** `feat: cliente de Claude, coste y tope mensual`

---

### Task 5: Ficha automática de prenda (tagging)

**Files:**
- Create: `server/tagging.ts`, `api/garments/tag.ts`
- Test: `server/tagging.test.ts`, `api/garments/tag.test.ts`

**Interfaces:**
- Consumes: `requireAccess`, `json` (Task 2); `db`, `ownerId`, `BUCKET`, `rowToGarment` (Task 3); `anthropic`, `modelFor`, `checkBudget`, `recordUsage` (Task 4).
- Produces (`server/tagging.ts`):
  - `TaggingSchema` (zod): `{ is_garment: boolean; type: z.enum(GARMENT_TYPES); description: string /* en español, ≤ 60 caracteres, p. ej. "camisa oxford azul claro" */; colors: string[] /* 1–3, nombres en español */; formality: int 1–5; seasons: Season[] /* ≥ 1 */; pattern: string | null; material: string | null }`
  - `TAGGING_SYSTEM: string`: instrucciones fijas en español. Escala de formalidad: 1 = deporte/casa, 2 = informal, 3 = smart casual, 4 = formal de oficina, 5 = traje/ceremonia. Si la foto no es una prenda o complemento, `is_garment = false`.
  - `buildTaggingRequest(imageBase64: string, mediaType: "image/webp" | "image/png" | "image/jpeg", model: string)`: devuelve los parámetros de `client.messages.parse`, con `system: TAGGING_SYSTEM`, contenido `[{type:"image", source:{type:"base64", media_type, data}}, {type:"text", text:"Rellena la ficha de esta prenda."}]`, `output_config: { format: zodOutputFormat(TaggingSchema), effort: "low" }` y `max_tokens: 2000`.
  - `interpretTagging(resp): { ok: true; tags: z.infer<typeof TaggingSchema> } | { ok: false; error: string }`. Errores: `stop_reason === "refusal"` → `"Claude no ha podido analizar esta foto"`; `parsed_output` nulo → `"Respuesta no válida"`; `is_garment === false` → `"No parece una prenda"`.
- Produces (`api/garments/tag.ts`): `POST(req)` con body `{ garmentId: string }`. Pasos: acceso → `checkBudget` → carga la fila. Si ya está `ready`, devuelve la prenda sin llamar a Claude (idempotente). Si no: descarga `image_path` del bucket → `parse` → `recordUsage` → actualiza la fila a `ready` con los tags, o a `error` con el mensaje → `200 { garment: Garment }`.

- [ ] **Step 1: Write the failing tests**

```ts
test("buildTaggingRequest incluye la imagen en base64 antes del texto y el modelo indicado", () => {
  const p = buildTaggingRequest("AAA", "image/webp", "claude-haiku-5-5");
  expect(p.model).toBe("claude-haiku-5-5");
  expect(p.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/webp", data: "AAA" } });
});
test("interpretTagging: refusal → error legible", () => {
  expect(interpretTagging({ stop_reason: "refusal", parsed_output: null } as any)).toEqual({ ok: false, error: "Claude no ha podido analizar esta foto" });
});
test("interpretTagging: is_garment=false → 'No parece una prenda'", () => {});
test("interpretTagging: parsed_output null → 'Respuesta no válida'", () => {});
// api/garments/tag.test.ts (db, anthropic mockeados)
test("prenda ya ready → no llama a Claude", async () => {});
test("presupuesto agotado → 402 y la fila sigue pending", async () => {});
test("respuesta válida → fila ready con type/colors/formality y se registra el uso", async () => {});
test("refusal → fila error con mensaje, respuesta 200", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run server/tagging.test.ts api/garments/tag.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: ficha automática de prenda con Claude`

---

### Task 6: Alta de prenda, subida firmada y tratamiento de imagen en el móvil

**Files:**
- Create: `api/garments/create.ts`, `src/lib/image.ts`
- Test: `api/garments/create.test.ts`, `src/lib/image.test.ts`

**Interfaces:**
- Produces (`api/garments/create.ts`): `POST(req)` → crea la fila `pending` con `image_path = "<ownerId>/<garmentId>.webp"` y devuelve `201 { garmentId: string; uploadUrl: string }`, con `uploadUrl` de `db().storage.from(BUCKET).createSignedUploadUrl(path)` (`signedUrl`).
- Produces (`src/lib/image.ts`):
  - `fitWithin(w: number, h: number, max = 1024): { w: number; h: number }` (sin ampliar nunca).
  - `compressImage(file: Blob, max = 1024): Promise<Blob>`: `createImageBitmap` + canvas → JPEG 0,85. Si no se puede decodificar, lanza `ImageDecodeError("No se puede leer esta foto")`.
  - `removeBackground(img: Blob): Promise<Blob>`: envuelve `@imgly/background-removal` con salida `image/webp` transparente. El modelo se carga en diferido la primera vez.
  - `prepareGarmentImage(file: Blob): Promise<Blob>` = `removeBackground(await compressImage(file))`.
  - `uploadToSignedUrl(url: string, blob: Blob): Promise<void>`: `fetch(url, { method: "PUT", headers: { "content-type": "image/webp" }, body: blob })`. Si no es `ok`, lanza un error. (Al implementar, verificar contra la documentación de Supabase que el `signedUrl` acepta `PUT` directo; si no, usar el endpoint documentado sin añadir `supabase-js` al cliente.)

- [ ] **Step 1: Write the failing tests**

```ts
test("fitWithin reduce 4032×3024 a 1024×768 y no amplía 800×600", () => {
  expect(fitWithin(4032, 3024)).toEqual({ w: 1024, h: 768 });
  expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
});
test("compressImage lanza ImageDecodeError si createImageBitmap falla", async () => {
  vi.stubGlobal("createImageBitmap", () => Promise.reject(new Error("bad")));
  await expect(compressImage(new Blob(["x"]))).rejects.toBeInstanceOf(ImageDecodeError);
});
test("create → 201 con garmentId y uploadUrl; fila pending con image_path <owner>/<id>.webp", async () => {});
test("create sin código → 401", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run api/garments/create.test.ts src/lib/image.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: alta de prenda, compresión y quitar fondo`

---

### Task 7: Cola de carga por lotes que se retoma al reabrir

**Files:**
- Create: `src/lib/uploadQueue.ts`, `api/garments/upload-url.ts`
- Test: `src/lib/uploadQueue.test.ts`, `api/garments/upload-url.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `UnauthorizedError`, `BudgetExceededError` (Task 2); `prepareGarmentImage`, `uploadToSignedUrl`, `ImageDecodeError` (Task 6); endpoints `create` y `tag` (Tasks 5–6).
- Produces:
  - `type QueueItemStatus = "queued" | "created" | "uploaded" | "done" | "error"`
  - `interface QueueItem { id: string; status: QueueItemStatus; garmentId?: string; error?: string }` (la foto original se guarda en IndexedDB con la clave `vistet.blob.<id>`; la lista, en `vistet.queue`)
  - `type QueueState = "idle" | "running" | "paused_budget" | "paused_auth"`
  - `interface QueueDeps { prepare(b: Blob): Promise<Blob>; create(): Promise<{ garmentId: string; uploadUrl: string }>; upload(url: string, b: Blob): Promise<void>; tag(garmentId: string): Promise<void>; store: { get; set; del } }`
  - `createUploadQueue(deps: QueueDeps): { add(files: Blob[]): Promise<void>; resume(): Promise<void>; items(): QueueItem[]; state(): QueueState; subscribe(fn: () => void): () => void; retry(id: string): Promise<void>; clearDone(): Promise<void> }`
  - `defaultQueueDeps(): QueueDeps` (cablea los módulos reales e idb-keyval).
- Comportamiento: procesa de uno en uno. `queued` → prepare → create (guarda `garmentId` y pasa a `created` **antes** de subir) → upload (`uploaded`) → tag (`done`, se borra el blob). Un elemento `created` se retoma desde upload; uno `uploaded`, desde tag. `ImageDecodeError` u otro error del elemento → `error` y sigue con el siguiente. `BudgetExceededError` → estado `paused_budget`, el elemento no cambia. `UnauthorizedError` → `paused_auth`, el elemento no cambia. Las URL de subida no se guardan (caducan): un elemento `created` pide una URL nueva con `POST /api/garments/upload-url { garmentId }` → `200 { uploadUrl }` (nuevo archivo `api/garments/upload-url.ts`; `404` si la prenda no existe o no es del propietario). `QueueDeps` añade `renewUploadUrl(garmentId: string): Promise<string>`.

- [ ] **Step 1: Write the failing tests** (deps falsos y store en memoria)

```ts
test("procesa 3 fotos en orden y termina con 3 done", async () => {});
test("reanudar tras 'cerrar' en created: no vuelve a llamar a create, sí a upload y tag", async () => {
  // store con un item {status:"created", garmentId:"g1"} → resume() → expect(deps.create).not.toHaveBeenCalled()
});
test("ImageDecodeError en la 2ª foto: la 2ª queda error y la 3ª termina done", async () => {});
test("BudgetExceededError en tag: estado paused_budget y el item sigue uploaded", async () => {});
test("UnauthorizedError: estado paused_auth y ningún item pasa a error", async () => {});
test("retry(id) de un item en error lo vuelve a procesar", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/uploadQueue.test.ts` → FAIL. Implementar (incluido el handler `upload-url`, con su test "upload-url de una prenda de otro usuario → 404"). Run → PASS.
- [ ] **Step 3: Commit** `feat: cola de carga por lotes reanudable`

---

### Task 8: Pantalla Armario (subir, revisar, editar)

**Files:**
- Create: `api/garments/index.ts` (GET lista, PATCH, DELETE)
- Create: `src/screens/armario/ArmarioScreen.tsx`, `src/screens/armario/UploadPanel.tsx`, `src/screens/armario/GarmentGrid.tsx`, `src/screens/armario/GarmentEditor.tsx`, `src/screens/armario/labels.ts`
- Modify: `src/App.tsx` (pestaña `armario` → `ArmarioScreen`)
- Test: `api/garments/index.test.ts`, `src/screens/armario/*.test.tsx`

**Interfaces:**
- Consumes: `Garment`, `GARMENT_TYPES`, `layerOf`, `GarmentPatchSchema`, `rowToGarment`, `garmentPatchToRow` (Task 3); `createUploadQueue`, `defaultQueueDeps` (Task 7); `apiFetch` (Task 2).
- Produces (`api/garments/index.ts`):
  - `GET` → `200 { garments: Garment[] }` del propietario, con `imageUrl` firmada (1 h, `createSignedUrls` en una sola llamada).
  - `PATCH ?id=` con body `GarmentPatchSchema` → `200 { garment }` o `400 { error: "invalid", issues }`. Vincular traje: si `suitPairId` apunta a otra prenda, se actualizan las dos filas para que se apunten mutuamente.
  - `DELETE ?id=` → borra la fila y el archivo, y desvincula su pareja de traje → `204`.
- Produces (`labels.ts`): `TYPE_LABEL: Record<GarmentType, string>` en español ("Camiseta", "Pantalón vaquero", "Chaqueta de traje"…), `AVAILABILITY_LABEL` ("Disponible", "En la lavandería", "Guardada"), `FORMALITY_LABEL` (1 "Deporte/casa" … 5 "Traje/ceremonia").
- UI:
  - `ArmarioScreen`: cabecera "Armario (N prendas)", botón "Añadir prendas" y debajo `UploadPanel` y `GarmentGrid`.
  - `UploadPanel`: `<input type="file" accept="image/*" multiple>` (permite cámara y galería), progreso "Procesando 3 de 20", lista de elementos en `error` con "Reintentar", y avisos por estado: `paused_budget` → "Has llegado al tope de gasto del mes. Las fotos pendientes se procesarán el mes que viene o si subes el tope."; `paused_auth` → se muestra la pantalla de código. Llama a `queue.resume()` al montarse (retoma lo pendiente al reabrir).
  - `GarmentGrid`: agrupado por capa (Arriba, Jerséis, Abajo, Abrigo, Calzado, Complementos), con filtro por disponibilidad. Las prendas `error` aparecen arriba con la marca "Revisar". Las no disponibles salen atenuadas.
  - `GarmentEditor` (al tocar una prenda): todos los campos editables, cambio rápido de disponibilidad (3 botones), "Es parte de un traje" → elegir la pareja entre las prendas `pantalon_traje`/`chaqueta_traje`, interruptor "Se puede usar suelta" (solo en `chaqueta_traje`) y "Eliminar" con confirmación.

- [ ] **Step 1: Write the failing tests**

```ts
test("GET devuelve solo prendas del propietario con imageUrl", async () => {});
test("PATCH con formality 7 → 400", async () => {});
test("PATCH suitPairId vincula ambas prendas", async () => {});
test("DELETE desvincula la pareja de traje y borra el archivo", async () => {});
test("GarmentGrid agrupa por capa y marca 'Revisar' las de error", () => {});
test("GarmentEditor: cambiar a 'En la lavandería' envía PATCH {availability:'lavanderia'}", async () => {});
test("UploadPanel muestra el aviso de tope cuando la cola está paused_budget", () => {});
test("UploadPanel llama a resume() al montarse", () => {});
```

- [ ] **Step 2:** Run `npx vitest run api/garments/index.test.ts src/screens/armario` → FAIL. Implementar. Run → PASS. Run `npx vitest run` (todo) → PASS. Run `npm run build` → OK.
- [ ] **Step 3: Commit** `feat: pantalla Armario`

---

### Task 9: Puesta en marcha (cuentas, despliegue y prueba en el móvil)

Pasos que hace Alejandro, guiado. El implementador prepara `.env.example` y un `docs/puesta-en-marcha.md` con estos pasos exactos.

**Files:**
- Create: `docs/puesta-en-marcha.md`
- Modify: `.env.example` (`ACCESS_CODE`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `MODEL_TAGGING=claude-haiku-5-5`, `MONTHLY_BUDGET_USD=5`)

- [ ] **Step 1:** Supabase: crear el proyecto (plan gratuito, región UE), ejecutar `supabase/migrations/0001_init.sql` en el editor SQL y copiar la URL y la service key.
- [ ] **Step 2:** Anthropic: crear la cuenta en console.anthropic.com, cargar saldo, crear la API key y fijar en la consola un límite de gasto mensual como segunda red de seguridad.
- [ ] **Step 3:** GitHub: crear el repositorio y subir el código. Vercel: importar el repositorio, añadir las variables de entorno (`OWNER_USER_ID` = un UUID generado una vez) y desplegar.
- [ ] **Step 4: Prueba de humo en el móvil:**
  - abrir la URL, introducir el código y "Añadir a pantalla de inicio";
  - subir 5–10 fotos reales, cerrar la app a mitad y reabrirla para comprobar que se retoma;
  - revisar las fichas, editar una prenda, vincular un traje y marcar una prenda como lavandería.
  - Esperado: las prendas salen sin fondo y con la ficha razonable, sin duplicados, y el gasto registrado en `usage_ledger` es de céntimos.
- [ ] **Step 5:** Anotar la calidad de las fichas con Haiku (aciertos y fallos). Si es floja, cambiar `MODEL_TAGGING=claude-sonnet-5-5` en Vercel y repetir.
- [ ] **Step 6: Commit** `docs: puesta en marcha`
