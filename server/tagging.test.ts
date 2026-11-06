// @vitest-environment node
import { buildTaggingRequest, interpretTagging } from "./tagging";

const validTags = {
  is_garment: true, type: "camisa", description: "camisa oxford azul claro", colors: ["azul claro"],
  formality: 3, seasons: ["primavera", "otono"], pattern: null, material: "algodón",
};

test("buildTaggingRequest incluye la imagen en base64 antes del texto y el modelo indicado", () => {
  const p = buildTaggingRequest("AAA", "image/webp", "claude-haiku-5-5");
  expect(p.model).toBe("claude-haiku-5-5");
  const content = p.messages[0].content as unknown as Array<Record<string, unknown>>;
  expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/webp", data: "AAA" } });
  expect(content[1]).toMatchObject({ type: "text" });
  expect(p.output_config?.effort).toBe("low");
});

test("interpretTagging: refusal → error legible", () => {
  expect(interpretTagging({ stop_reason: "refusal", parsed_output: null })).toEqual({
    ok: false, error: "Claude no ha podido analizar esta foto",
  });
});

test("interpretTagging: is_garment=false → 'No parece una prenda'", () => {
  expect(interpretTagging({ stop_reason: "end_turn", parsed_output: { ...validTags, is_garment: false } })).toEqual({
    ok: false, error: "No parece una prenda",
  });
});

test("interpretTagging: parsed_output null → 'Respuesta no válida'", () => {
  expect(interpretTagging({ stop_reason: "end_turn", parsed_output: null })).toEqual({ ok: false, error: "Respuesta no válida" });
});

test("interpretTagging: max_tokens → 'Respuesta no válida'", () => {
  expect(interpretTagging({ stop_reason: "max_tokens", parsed_output: validTags })).toEqual({ ok: false, error: "Respuesta no válida" });
});

test("interpretTagging: formality fuera de rango → 'Respuesta no válida'", () => {
  expect(interpretTagging({ stop_reason: "end_turn", parsed_output: { ...validTags, formality: 9 } })).toEqual({
    ok: false, error: "Respuesta no válida",
  });
});

test("interpretTagging: válido → tags", () => {
  expect(interpretTagging({ stop_reason: "end_turn", parsed_output: validTags })).toEqual({ ok: true, tags: validTags });
});
