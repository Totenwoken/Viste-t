// @vitest-environment node
import { modelFor } from "./claude.js";

afterEach(() => {
  delete process.env.MODEL_TAGGING;
});

test("modelFor('tagging') usa claude-haiku-5-5 por defecto", () => {
  expect(modelFor("tagging")).toBe("claude-haiku-5-5");
});

test("modelFor('tagging') respeta MODEL_TAGGING", () => {
  process.env.MODEL_TAGGING = "claude-sonnet-5-5";
  expect(modelFor("tagging")).toBe("claude-sonnet-5-5");
});
