# Viste-t · Plan 2 de 4: Conjuntos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla **Inicio** (fecha y tiempo, "¿Qué me pongo hoy?", 4 estilos, barra "Quiero ponerme…") y pantalla de **Resultado** (collage de sus prendas, explicación, "Me lo pongo", "Otro" con motivo opcional, candados, "Cambiar solo esta", "Me puse otra cosa", guardar/compartir imagen), con aprendizaje a partir de su historial.

**Architecture:** Una función de Vercel `api/outfits/generate.ts` construye el prompt con el armario disponible (fichas en texto, en caché), el historial y el tiempo, y pide a Claude Haiku 5.5 una lista de ids con salida estructurada. El servidor **valida** el conjunto con reglas puras (`shared/outfit.ts`); si no es válido, reintenta una vez indicando el fallo. Otras funciones registran "Me lo pongo", motivos y "Me puse otra cosa". El tiempo se pide en el móvil a Open-Meteo (gratis, sin clave). El collage se compone en el móvil: CSS para verlo y canvas para exportarlo como imagen.

**Tech Stack:** el del plan 1 (Vite + React + TS, Vercel Functions, Supabase, @anthropic-ai/sdk, zod, Vitest) + Open-Meteo.

**Spec:** `docs/superpowers/specs/2026-11-06-viste-t-design.md` (§5.3 Inicio, §5.4 Resultado, §5.8 Aprendizaje, §6)

## Global Constraints

- Todo lo del plan 1 sigue vigente: interfaz en español, código de acceso en cada función de `api/`, consultas filtradas por `ownerId()`, tope mensual con `checkBudget()`/`recordUsage()`, imports relativos del servidor con extensión `.js`.
- Modelo de conjuntos configurable: `MODEL_OUTFIT`, por defecto `claude-haiku-5-5` (añadir la tarea `"outfit"` a `server/claude.ts`).
- Restricción dura del spec: el conjunto **solo** usa prendas existentes del propietario con `status = 'ready'` y `availability = 'disponible'`.
- Composición: exactamente 1 de abajo (`bottom`) y 1 calzado (`shoes`); **al menos una** prenda de torso entre `top` y `mid` (un jersey o un cuello alto puede ir solo, sin camiseta debajo, como en sus referencias); como máximo 1 `top`, 1 `mid`, 1 `outer` y 2 `accessory`.
- Trajes: en `traje`, chaqueta de traje + su pantalón vinculado (`suitPairId`). En cualquier modo, una `chaqueta_traje` con `jacketCombinable = false` solo puede ir con su propio pantalón.
- Estilos (§5.3): `vaqueros` → abajo `pantalon_vaquero`, arriba camiseta o camisa (polo permitido), jersey opcional. `formal` → arriba `camisa` y/o `jersey` (sin camiseta, sudadera ni polo a la vista), cualquier pantalón salvo `bermuda`. `traje` → traje completo, arriba `camisa`. `chinos` → abajo `pantalon_chino`, arriba camisa o camiseta (polo permitido), jersey opcional. `auto` → libre.
- Prendas pedidas en "Quiero ponerme…" y prendas con candado: **siempre** incluidas. "Otro" mantiene las bloqueadas.
- Motivos de "Otro" (texto exacto): `muy formal` · `muy informal` · `colores` · `me lo puse hace poco` · `no me apetece esa prenda`.
- Historial que recibe Claude: prendas puestas en los **últimos 7 días**, y los **últimos 30** conjuntos aceptados y rechazados con sus motivos.
- El tiempo es opcional: si no hay permiso de ubicación ni ciudad guardada, o falla la red, se genera igualmente sin tiempo.

## Review Focus

1. **Claude devuelve un id inexistente, de otro usuario o de una prenda en la lavandería** → el servidor lo rechaza, reintenta una vez con el motivo y, si vuelve a fallar, responde `422` con un mensaje legible. Nunca se muestra una prenda que no se puede poner. Tests en Task 2 y Task 3.
2. **"Quiero ponerme…" pide algo que no está en el armario** ("zapatillas rojas" sin tenerlas) → se genera igualmente y se avisa "No he encontrado «zapatillas rojas» en tu armario". Test en Task 3.
3. **Una prenda con candado pasa a lavandería o se elimina antes de pulsar "Otro"** → se quita del candado sin fallar y se avisa. Test en Task 3.
4. **Armario insuficiente** (sin calzado, sin pantalón disponible, o sin vaqueros al pulsar "Vaqueros") → `422 { error: "not_enough", message }` con un mensaje que diga qué falta, sin llamar a Claude. Tests en Task 2 y Task 3.
5. **Tope de gasto alcanzado al pulsar "Otro" o "Cambiar solo esta"** → aviso y se mantiene el conjunto actual en pantalla. Test en Task 7.

---

### Task 1: Datos de conjuntos y reglas de validación

**Files:**
- Create: `supabase/migrations/0002_outfits.sql`, `shared/outfit.ts`
- Modify: `server/testing/fakeDb.ts` (añadir `in(col, values)`, `gte(col, v)`, `limit(n)`)
- Test: `shared/outfit.test.ts`

**Interfaces:**
- Produces (`shared/outfit.ts`):
  - `OUTFIT_MODES = ["auto","vaqueros","formal","traje","chinos"] as const`, `type OutfitMode`
  - `REJECT_REASONS = ["muy formal","muy informal","colores","me lo puse hace poco","no me apetece esa prenda"] as const`, `type RejectReason`
  - `interface Outfit { id: string; mode: OutfitMode | "manual"; request: string | null; garmentIds: string[]; lockedIds: string[]; explanation: string; status: "proposed" | "worn" | "rejected"; rejectReason: RejectReason | null; wornOn: string | null; createdAt: string; notes: string[] }` (`notes`: avisos para la UI, p. ej. "No he encontrado…"; no se guarda en la BD)
  - `interface OutfitRules { mode: OutfitMode; lockedIds: string[] }`
  - `interface Weather { tempC: number; minC: number; maxC: number; rainProb: number; label: string; icon: string }` (compartido por servidor y móvil)
  - `validateOutfit(ids: string[], available: Garment[], rules: OutfitRules): { ok: true } | { ok: false; problems: string[] }`. Los `problems` van en español y se reenvían a Claude en el reintento, p. ej. `"falta calzado"`, `"hay 2 prendas de abajo"`, `"la prenda X no está disponible"`, `"falta la prenda bloqueada X"`, `"en vaqueros el pantalón debe ser vaquero"`, `"la chaqueta de traje X solo puede ir con su pantalón"`.
  - `missingForMode(available: Garment[], mode: OutfitMode): string | null`: devuelve el mensaje si no hay prendas suficientes para el modo (p. ej. `"No tienes vaqueros disponibles"`, `"Necesitas al menos una prenda de arriba, una de abajo y calzado disponibles"`, `"No tienes ningún traje completo vinculado"`); `null` si se puede.
- Migración `0002_outfits.sql`:
  - `outfits` (`id uuid pk default gen_random_uuid()`, `user_id uuid not null`, `mode text not null`, `request text`, `garment_ids uuid[] not null`, `locked_ids uuid[] not null default '{}'`, `explanation text not null default ''`, `status text not null default 'proposed' check (status in ('proposed','worn','rejected'))`, `reject_reason text`, `worn_on date`, `weather jsonb`, `created_at timestamptz default now()`), con índice en `(user_id, created_at)`;
  - `outfit_swaps` (`id`, `user_id`, `outfit_id uuid references outfits(id) on delete cascade`, `garment_id uuid`, `created_at`), donde se registra cada "Cambiar solo esta";
  - RLS activado sin políticas, igual que en 0001.

- [ ] **Step 1: Write the failing tests** (`shared/outfit.test.ts`, con prendas de `garment()` de testData adaptadas):

```ts
test("conjunto mínimo válido: camisa + chino + calzado", () => {
  expect(validateOutfit(["c", "p", "z"], wardrobe, { mode: "auto", lockedIds: [] })).toEqual({ ok: true });
});
test("un jersey solo, sin camiseta debajo, es válido", () => {
  expect(validateOutfit(["jersey", "v", "z"], wardrobe, { mode: "auto", lockedIds: [] })).toEqual({ ok: true });
});
test("sin ninguna prenda de torso no es válido", () => {
  expect(validateOutfit(["v", "z"], wardrobe, { mode: "auto", lockedIds: [] })).toEqual({ ok: false, problems: expect.arrayContaining(["falta una prenda de arriba o un jersey"]) });
});
test("formal acepta jersey de cuello alto sin camisa y rechaza camiseta", () => {});
test("falta calzado y sobra un pantalón", () => {
  const r = validateOutfit(["c", "p", "v"], wardrobe, { mode: "auto", lockedIds: [] });
  expect(r).toEqual({ ok: false, problems: expect.arrayContaining(["falta calzado", "hay 2 prendas de abajo"]) });
});
test("rechaza prendas en la lavandería o desconocidas", () => {
  const r = validateOutfit(["c", "p", "z", "lav"], wardrobe, { mode: "auto", lockedIds: [] });
  expect(r.ok).toBe(false);
});
test("vaqueros exige pantalón vaquero", () => {
  expect(validateOutfit(["c", "p", "z"], wardrobe, { mode: "vaqueros", lockedIds: [] }).ok).toBe(false);
  expect(validateOutfit(["c", "v", "z"], wardrobe, { mode: "vaqueros", lockedIds: [] }).ok).toBe(true);
});
test("traje exige chaqueta y su pantalón vinculado", () => {
  expect(validateOutfit(["c", "jt", "pt", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(true);
  expect(validateOutfit(["c", "jt", "p", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(false);
});
test("chaqueta de traje no combinable no puede ir con otro pantalón en auto", () => {
  expect(validateOutfit(["c", "jt", "p", "z"], wardrobe, { mode: "auto", lockedIds: [] }).ok).toBe(false);
});
test("las prendas bloqueadas deben estar", () => {
  const r = validateOutfit(["c", "p", "z"], wardrobe, { mode: "auto", lockedIds: ["j"] });
  expect(r.ok).toBe(false);
});
test("missingForMode: sin vaqueros disponibles", () => {
  expect(missingForMode(wardrobe.filter((g) => g.type !== "pantalon_vaquero"), "vaqueros")).toBe("No tienes vaqueros disponibles");
});
test("missingForMode: sin calzado", () => {
  expect(missingForMode(wardrobe.filter((g) => g.type !== "calzado"), "auto")).toBe(
    "Necesitas al menos una prenda de arriba, una de abajo y calzado disponibles",
  );
});
```

- [ ] **Step 2:** Run `npx vitest run shared/outfit.test.ts` → FAIL. Implementar, junto con la migración y los métodos nuevos de `fakeDb`. Run → PASS.
- [ ] **Step 3: Commit** `feat: datos de conjuntos y reglas de validación`

---

### Task 2: Prompt de conjuntos e interpretación de la respuesta

**Files:**
- Create: `server/outfitPrompt.ts`
- Modify: `server/claude.ts` (`type Task = "tagging" | "outfit"`, `MODEL_OUTFIT`)
- Test: `server/outfitPrompt.test.ts`

**Interfaces:**
- Consumes: `Garment`, `layerOf` (plan 1); `OutfitMode`, `Outfit`, `Weather`, `validateOutfit` (Task 1).
- Produces:
  - `interface HistoryItem { garmentIds: string[]; status: "worn" | "rejected"; rejectReason: string | null; date: string }`
  - `interface OutfitContext { today: string /* YYYY-MM-DD */; weather: Weather | null; mode: OutfitMode; request: string | null; lockedIds: string[]; excludedIds: string[]; wornRecently: string[]; history: HistoryItem[]; retryProblems?: string[] }`
  - `OutfitOutputSchema` (zod): `{ garment_ids: string[]; explanation: string /* ≤ 200 caracteres, en español */; requested_ids: string[] /* prendas que casan con "Quiero ponerme…" */; missing_request: string | null /* parte del pedido que no encontró */ }`
  - `wardrobeBlock(garments: Garment[]): string`: una línea por prenda `id | tipo | descripción | colores | formalidad | estaciones`, ordenada por id para que la caché funcione.
  - `buildOutfitRequest(garments: Garment[], ctx: OutfitContext, model: string)`: devuelve los parámetros de `messages.parse`, con `system` = reglas fijas + bloque del armario con `cache_control: { type: "ephemeral" }` en el último bloque de sistema; un único mensaje de usuario con fecha, tiempo, modo, pedido, bloqueadas, excluidas, historial y `retryProblems` si hay; `output_config: { format: zodOutputFormat(OutfitOutputSchema), effort: "low" }`; `max_tokens: 4000`.
  - `interpretOutfit(resp): { ok: true; out: z.infer<typeof OutfitOutputSchema> } | { ok: false; error: string }` (`refusal` → `"Claude no ha podido proponer un conjunto"`; distinto de `end_turn` o sin `parsed_output` → `"Respuesta no válida"`).
- `shared/styleProfile.ts` exporta `DEFAULT_STYLE_PROFILE: string`, el perfil de estilo de la sección "Perfil de estilo inicial" al final de este plan, copiado literal. Va en el `system` **antes** del bloque del armario. En el plan 3 lo sustituirá el perfil editable de la sección Estilo.
- Reglas del prompt de sistema (copiar las del bloque Global Constraints): composición, estilos, trajes, bloqueadas, no repetir lo puesto en 7 días salvo que esté bloqueado, evitar combinaciones rechazadas y tener en cuenta sus motivos, adaptar capas y tejidos a la temperatura, y explicación breve en segunda persona.

- [ ] **Step 1: Write the failing tests**

```ts
test("wardrobeBlock lista una línea por prenda ordenada por id", () => {});
test("buildOutfitRequest pone el armario en el system con cache_control y usa el modelo indicado", () => {});
test("el system incluye DEFAULT_STYLE_PROFILE antes del armario", () => {});
test("el mensaje de usuario incluye modo, pedido, bloqueadas, tiempo y problemas del reintento", () => {
  const p = buildOutfitRequest(wardrobe, { ...ctx, mode: "vaqueros", request: "zapatillas marrones", lockedIds: ["z"], retryProblems: ["falta calzado"] }, "claude-haiku-5-5");
  const text = JSON.stringify(p.messages);
  for (const s of ["vaqueros", "zapatillas marrones", "z", "falta calzado", "14"]) expect(text).toContain(s);
});
test("sin tiempo no menciona temperatura", () => {});
test("interpretOutfit: refusal → error legible", () => {});
test("modelFor('outfit') usa MODEL_OUTFIT o claude-haiku-5-5", () => {});
```

- [ ] **Step 2:** Run `npx vitest run server/outfitPrompt.test.ts server/claude.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: prompt de conjuntos`

---

### Task 3: API para generar conjuntos

**Files:**
- Create: `api/outfits/generate.ts`, `server/outfitsRepo.ts`
- Test: `api/outfits/generate.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `requireAccess`, `json`, `db`, `ownerId`, `checkBudget`, `recordUsage`, `anthropic`, `modelFor`, `rowToGarment` (plan 1).
- Produces:
  - `server/outfitsRepo.ts`: `rowToOutfit(row): Outfit`; `loadAvailable(): Promise<Garment[]>` (`ready` + `disponible`, sin imageUrl); `loadHistory(today: string): Promise<{ wornRecently: string[]; history: HistoryItem[] }>`.
  - `POST /api/outfits/generate` con body `{ mode: OutfitMode; request?: string; lockedIds?: string[]; previousOutfitId?: string; replaceId?: string; weather?: Weather | null }` → `200 { outfit: Outfit; garments: Garment[] /* con imageUrl */ }`.
- Comportamiento, en orden:
  1. acceso, y zod sobre el body (`400` si no es válido);
  2. `loadAvailable()`. Los `lockedIds` que ya no están disponibles se quitan y se añade la nota `"«descripción» ya no está disponible y la he quitado"` (si la prenda existe pero no está disponible) o `"Una prenda bloqueada ya no está en tu armario"`;
  3. si llega `replaceId` con `previousOutfitId`: los `lockedIds` pasan a ser las prendas del conjunto anterior menos `replaceId`; `excludedIds = [replaceId]`; se inserta una fila en `outfit_swaps`;
  4. `missingForMode()` sobre las disponibles, sin las excluidas → si hay mensaje, `422 { error: "not_enough", message }` **sin** llamar a Claude ni comprobar el tope;
  5. `checkBudget()`;
  6. llamada a Claude → `recordUsage("outfit", …)` → `interpretOutfit` → `validateOutfit(garment_ids, available, { mode, lockedIds: [...lockedIds, ...requested_ids] })`. Si no es válido: **un** reintento con `retryProblems`. Si vuelve a fallar: `422 { error: "invalid_outfit", message: "No he conseguido montar un conjunto válido. Prueba otra vez." }`;
  7. si `missing_request`, se añade la nota `"No he encontrado «X» en tu armario"`;
  8. se inserta en `outfits` (`status: "proposed"`, `locked_ids` = bloqueadas + pedidas, `request`, `weather`) y se devuelve el conjunto con las prendas y sus URLs firmadas.

- [ ] **Step 1: Write the failing tests** (fakeDb + anthropic mockeado, como `tag.test.ts`)

```ts
test("genera, valida, guarda y devuelve el conjunto con imageUrl", async () => {});
test("id inventado por Claude → reintento con el problema y éxito al segundo intento", async () => {});
test("dos respuestas inválidas → 422 invalid_outfit y se registra el gasto de ambas", async () => {});
test("sin vaqueros disponibles → 422 not_enough sin llamar a Claude", async () => {});
test("prenda bloqueada que pasó a lavandería se quita y añade nota", async () => {});
test("missing_request añade la nota 'No he encontrado «zapatillas rojas» en tu armario'", async () => {});
test("replaceId: bloquea el resto del conjunto anterior, excluye esa prenda y registra el swap", async () => {});
test("las prendas pedidas (requested_ids) quedan en locked_ids", async () => {});
test("presupuesto agotado → 402", async () => {});
test("sin código → 401", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run api/outfits/generate.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: API para generar conjuntos`

---

### Task 4: API para "Me lo pongo", motivos y "Me puse otra cosa"

**Files:**
- Create: `api/outfits/wear.ts`, `api/outfits/feedback.ts`, `api/outfits/wear-other.ts`
- Test: `api/outfits/actions.test.ts`

**Interfaces:**
- `POST /api/outfits/wear { outfitId }` → `status: "worn"`, `worn_on` = hoy (Europe/Madrid) → `200 { outfit }`. Si ya hay otro conjunto `worn` hoy, este lo sustituye: el anterior vuelve a `proposed` y `worn_on` a null.
- `POST /api/outfits/feedback { outfitId, reason?: RejectReason }` → `status: "rejected"` y `reject_reason` (o null) → `200 { outfit }`. Si el conjunto ya está `worn`, `409`.
- `POST /api/outfits/wear-other { garmentIds: string[] }` → valida que existan y sean del propietario (no exige reglas de composición) y crea un `outfits` con `mode: "manual"`, `status: "worn"` y `worn_on` hoy, con la misma sustitución del "worn" de hoy → `201 { outfit }`.
- Todas: acceso, filtro por propietario, `404` si el conjunto no existe.

- [ ] **Step 1: Write the failing tests**

```ts
test("wear marca worn con la fecha de hoy y desmarca el worn anterior del mismo día", async () => {});
test("feedback guarda el motivo; motivo desconocido → 400", async () => {});
test("feedback sobre un conjunto ya puesto → 409", async () => {});
test("wear-other con una prenda ajena → 400", async () => {});
test("wear-other crea un conjunto manual puesto hoy", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run api/outfits/actions.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: registrar conjuntos puestos y rechazados`

---

### Task 5: El tiempo de hoy

**Files:**
- Create: `src/lib/weather.ts`
- Test: `src/lib/weather.test.ts`

**Interfaces:**
- Produces:
  - `wmoLabel(code: number): { label: string; icon: string }`: 0 → `Despejado ☀️`; 1–3 → `Nubes y claros ⛅`; 45/48 → `Niebla 🌫️`; 51–67 y 80–82 → `Lluvia 🌧️`; 71–77 y 85–86 → `Nieve ❄️`; 95–99 → `Tormenta ⛈️`; cualquier otro → `—`.
  - `fetchWeather(lat: number, lon: number): Promise<Weather>`: `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`.
  - `geocodeCity(name: string): Promise<{ name: string; lat: number; lon: number } | null>`: `https://geocoding-api.open-meteo.com/v1/search?name=…&count=1&language=es`.
  - `getTodayWeather(): Promise<Weather | null>`: primero la ubicación del móvil (`navigator.geolocation`, timeout 5 s); si se deniega o falla, la ciudad guardada en `localStorage` `vistet.city` (`{ name, lat, lon }`); si tampoco hay, `null`. Cualquier error de red → `null`. Caché de 30 min en `localStorage` `vistet.weather`.
  - `saveCity(c: { name: string; lat: number; lon: number }): void`.

- [ ] **Step 1: Write the failing tests**

```ts
test("wmoLabel traduce los códigos principales", () => {
  expect(wmoLabel(0)).toEqual({ label: "Despejado", icon: "☀️" });
  expect(wmoLabel(61).label).toBe("Lluvia");
});
test("fetchWeather mapea la respuesta de Open-Meteo a Weather", async () => {});
test("getTodayWeather usa la ciudad guardada si se deniega la ubicación", async () => {});
test("getTodayWeather devuelve null sin ubicación ni ciudad, o si falla la red", async () => {});
test("usa la caché de 30 minutos", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/weather.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: tiempo de hoy con Open-Meteo`

---

### Task 6: Pantalla Inicio

**Files:**
- Modify: `src/screens/InicioScreen.tsx` (sustituye el marcador)
- Create: `src/screens/inicio/CityPicker.tsx`
- Test: `src/screens/InicioScreen.test.tsx`

**Interfaces:**
- Consumes: `getTodayWeather`, `geocodeCity`, `saveCity` (Task 5); `OutfitMode`, `Weather` (Task 1).
- Produces: `type OutfitRequest = { mode: OutfitMode; request: string | null }`; `<InicioScreen onRequest(r: OutfitRequest): void />`.
- UI (boceto A aprobado):
  - Arriba: fecha en español (`jueves, 6 de noviembre`, con `Intl.DateTimeFormat("es-ES")`) y `14°C ☁️ Nubes y claros`. Si no hay tiempo, el enlace "Añadir ciudad" abre `CityPicker` (campo de texto, botón "Buscar", resultado y "Usar esta ciudad").
  - "Hola" como título. El nombre no se conoce en v1, así que solo "Hola".
  - Botón principal "¿Qué me pongo hoy?", con el subtítulo "Te monto un conjunto con tu armario" → `onRequest({ mode: "auto", request: null })`.
  - Rejilla 2×2: 👖 Vaqueros, 👔 Formal, 🤵 Formal traje, 🩳 Chinos → modos `vaqueros`, `formal`, `traje`, `chinos`.
  - Barra "✏️ Quiero ponerme…" con botón → (deshabilitado si está vacía) → `onRequest({ mode: "auto", request: texto.trim() })`.

- [ ] **Step 1: Write the failing tests**

```ts
test("el botón principal pide un conjunto automático", async () => {});
test("cada botón de estilo pide su modo", async () => {
  // Vaqueros→vaqueros, Formal→formal, Formal traje→traje, Chinos→chinos
});
test("la barra de texto envía el pedido recortado y no se envía vacía", async () => {});
test("muestra la temperatura y el estado cuando hay tiempo", async () => {});
test("sin tiempo ofrece 'Añadir ciudad'", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run src/screens/InicioScreen.test.tsx` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: pantalla Inicio`

---

### Task 7: Pantalla Resultado (collage, candados, Otro, Me lo pongo)

**Files:**
- Create: `src/screens/outfit/OutfitScreen.tsx`, `src/screens/outfit/OutfitCollage.tsx`, `src/screens/outfit/WearOtherPicker.tsx`, `src/lib/outfitsApi.ts`
- Modify: `src/App.tsx` (la pestaña Inicio muestra `InicioScreen` u `OutfitScreen` según haya un pedido en curso)
- Test: `src/screens/outfit/OutfitScreen.test.tsx`, `src/lib/outfitsApi.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6; `apiFetch`, `BudgetExceededError` (plan 1).
- Produces (`src/lib/outfitsApi.ts`):
  - `class OutfitError extends Error { kind: "not_enough" | "invalid_outfit" }`.
  - `generateOutfit(body): Promise<{ outfit: Outfit; garments: Garment[] }>`: `422` → `OutfitError` con el `message` del servidor.
  - `wearOutfit(outfitId)`, `rejectOutfit(outfitId, reason?)`, `wearOther(garmentIds)`.
- `<OutfitScreen request={OutfitRequest} weather={Weather | null} onBack() />`:
  - Al montarse genera. Mientras tanto muestra "Montando tu conjunto…".
  - Muestra `OutfitCollage`, la explicación, `notes` (avisos) y los botones **"Me lo pongo ✓"** y **"Otro ↻"**.
  - **Candado** en cada prenda (🔒/🔓): las prendas pedidas salen bloqueadas. "Otro" envía `lockedIds` = las bloqueadas y `previousOutfitId`.
  - **"Otro"**: genera el siguiente al instante. Bajo el nuevo conjunto aparece "¿Por qué no te gustó el anterior?" con los 5 motivos; un toque llama a `rejectOutfit(previo, motivo)`. Si no toca ninguno, al generar el siguiente se llama a `rejectOutfit(previo)` sin motivo.
  - **Tocar una prenda** → menú con "Cambiar solo esta" (genera con `replaceId` y `previousOutfitId`) y "Bloquear/Desbloquear".
  - **"Me lo pongo"** → `wearOutfit`, muestra "¡Listo! Que tengas un buen día" y el botón "Volver".
  - **"Me puse otra cosa"** (enlace) → `WearOtherPicker`: rejilla del armario agrupada por capa, selección múltiple y "Guardar" → `wearOther`.
  - Errores: `BudgetExceededError` → "Has llegado al tope de gasto del mes" sin borrar el conjunto actual. `OutfitError` → su mensaje y el botón "Volver".
- `<OutfitCollage garments={Garment[]} lockedIds onToggleLock(id) onSelect(id) />`: disposición fija tipo *flat lay* en rejilla CSS de 2 columnas (izquierda: abrigo arriba y, debajo, prenda de arriba o jersey; derecha: pantalón; abajo a lo ancho: calzado y complementos), sobre fondo `--soft`.

- [ ] **Step 1: Write the failing tests**

```ts
test("al montarse pide el conjunto y lo muestra con su explicación", async () => {});
test("'Otro' mantiene las prendas bloqueadas y rechaza el anterior", async () => {});
test("un motivo tras 'Otro' se envía como feedback del conjunto anterior", async () => {});
test("'Cambiar solo esta' envía replaceId y previousOutfitId", async () => {});
test("'Me lo pongo' registra el conjunto y muestra la confirmación", async () => {});
test("con el tope alcanzado al pulsar 'Otro' se muestra el aviso y se mantiene el conjunto", async () => {});
test("422 not_enough muestra el mensaje del servidor", async () => {});
test("'Me puse otra cosa' guarda las prendas elegidas", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run src/screens/outfit src/lib/outfitsApi.test.ts` → FAIL. Implementar. Run → PASS. Run `npx vitest run` (todo) → PASS.
- [ ] **Step 3: Commit** `feat: pantalla de resultado de conjuntos`

---

### Task 8: Guardar o compartir el conjunto como imagen

**Files:**
- Create: `src/lib/collageImage.ts`
- Modify: `src/screens/outfit/OutfitScreen.tsx` (botón "Guardar imagen")
- Test: `src/lib/collageImage.test.ts`

**Interfaces:**
- Produces:
  - `collageLayout(garments: Garment[], width = 1080): { w: number; h: number; slots: { id: string; x: number; y: number; w: number; h: number }[] }`: función pura con la misma disposición que `OutfitCollage`, alto 1350 (4:5).
  - `renderCollage(garments: Garment[]): Promise<Blob>`: canvas, fondo `#ece8e1`, imágenes cargadas con `crossOrigin = "anonymous"` y `object-fit: contain` dentro de cada hueco; PNG.
  - `shareOrDownload(blob: Blob, filename = "conjunto.png"): Promise<void>`: `navigator.share({ files })` si `navigator.canShare` lo admite (iPhone → "Guardar imagen"); si no, descarga con un enlace.

- [ ] **Step 1: Write the failing tests**

```ts
test("collageLayout coloca arriba, abajo y calzado sin solaparse y dentro del lienzo", () => {});
test("con abrigo y jersey reparte la columna izquierda", () => {});
test("shareOrDownload usa navigator.share cuando canShare acepta archivos", async () => {});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/collageImage.test.ts` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Commit** `feat: guardar o compartir el conjunto como imagen`

---

### Task 9: Puesta en marcha y prueba

**Files:**
- Modify: `docs/puesta-en-marcha.md` (sección "Actualización: Conjuntos"), `.env.example` (`MODEL_OUTFIT=claude-haiku-5-5`)

- [ ] **Step 1:** Alejandro ejecuta `supabase/migrations/0002_outfits.sql` en el editor SQL de Supabase (resultado: "Success").
- [ ] **Step 2:** (Opcional) añadir `MODEL_OUTFIT` en Vercel. Si no se añade, se usa Haiku.
- [ ] **Step 3:** Push a `main` y esperar a que Vercel lo publique en **Ready**.
- [ ] **Step 4: Prueba en el iPhone:**
  - "¿Qué me pongo hoy?", cada uno de los 4 estilos y "Quiero ponerme… zapatillas marrones";
  - "Otro" con un motivo, bloquear una prenda y "Otro" otra vez, "Cambiar solo esta", "Me lo pongo", "Me puse otra cosa" y "Guardar imagen".
  - Esperado: los conjuntos solo usan sus prendas disponibles, las bloqueadas se mantienen y el gasto por conjunto es de céntimos o menos en `usage_ledger`.
- [ ] **Step 5: Commit** `docs: puesta en marcha de conjuntos`

---

## Perfil de estilo inicial (de sus capturas de Instagram, 2026-11-08)

Texto literal para `DEFAULT_STYLE_PROFILE`:

```
Estilo de Alejandro: masculino, limpio y "smart casual" moderno, de inspiración minimalista y algo clásica.
- Paleta: neutros y tierra como base (crema, blanco roto, beige/arena, camel, tabaco, marrón chocolate), azul marino, grises (claro y antracita), negro y blanco. Acentos sobrios y de uno en uno: burdeos, verde oliva o botella, verde salvia, azul petróleo; el rojo, muy ocasional.
- Combinaciones: 2–3 colores por conjunto, como mucho un color de acento. Contraste claro/oscuro entre la parte de arriba y la de abajo (p. ej. jersey crema con pantalón marino, jersey negro con vaquero claro). Conjuntos tono sobre tono en neutros también le gustan (beige, crema, tabaco).
- Siluetas: ajustadas pero no apretadas; pantalón slim o recto, bajo limpio; punto fino que marca hombros.
- Prendas que más usa en sus referencias: jersey de punto fino (cuello caja, cuello alto, medio cuello con cremallera), cárdigan con cremallera, polo (de punto, manga corta o larga), henley, camisa lisa u oxford, sobrecamisa; chaquetas cortas (Harrington, trucker de ante o pana, bomber, cazadora de piel). Abajo: vaqueros (azul medio o claro, gris, negro, blanco o crudo), chinos (beige, tabaco, oliva, crudo) y pantalón de pinzas de vestir.
- Capas típicas: jersey o camiseta lisa + chaqueta corta; camisa bajo jersey de cuello caja con el cuello asomando; cuello alto solo o bajo chaqueta.
- Calzado: zapatillas blancas de piel minimalistas (su favorito para vaqueros y chinos), botines chelsea (marrón de piel o ante, negro), zapato oxford/derby o mocasín marrón oscuro o burdeos para looks formales, zapatillas de ante en tonos tierra.
- Detalles: prendas lisas, sin logos ni estampados llamativos (como mucho rayas finas o diplomática en pantalón de vestir). Cinturón de piel a juego con el calzado cuando lleva camisa o pantalón de vestir. Complementos discretos: reloj, gafas de sol, pulsera de cuero.
- Evitar: chándal o ropa deportiva fuera de contexto, estampados grandes, mezclar muchos colores vivos, calzado deportivo técnico con pantalón de vestir.
```
