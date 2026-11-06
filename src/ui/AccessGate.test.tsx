import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessGate } from "./AccessGate";
import { setAccessCode } from "../lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("sin código muestra el formulario; con código válido muestra la app", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"ok":true}', { status: 200 })));
  render(<AccessGate><p>APP</p></AccessGate>);
  expect(screen.getByText("Introduce tu código de acceso")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Código"), "armario123");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("APP")).toBeInTheDocument();
});

test("código inválido muestra 'Código incorrecto'", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  render(<AccessGate><p>APP</p></AccessGate>);
  await userEvent.type(screen.getByLabelText("Código"), "malo");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Código incorrecto")).toBeInTheDocument();
  expect(screen.queryByText("APP")).toBeNull();
});

test("con un código guardado entra directamente", () => {
  setAccessCode("guardado");
  render(<AccessGate><p>APP</p></AccessGate>);
  expect(screen.getByText("APP")).toBeInTheDocument();
});

test("el evento vistet:unauthorized vuelve a mostrar el formulario", () => {
  setAccessCode("guardado");
  render(<AccessGate><p>APP</p></AccessGate>);
  act(() => {
    window.dispatchEvent(new Event("vistet:unauthorized"));
  });
  expect(screen.getByText("Introduce tu código de acceso")).toBeInTheDocument();
});
