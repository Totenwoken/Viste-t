import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GarmentEditor } from "./GarmentEditor";
import { garment } from "./testData";
import { setAccessCode } from "../../lib/api";

const JACKET = garment({ id: "j", type: "chaqueta_traje", description: "chaqueta traje gris" });
const TROUSERS = garment({ id: "t", type: "pantalon_traje", description: "pantalón traje gris" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setAccessCode("c");
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return new Response(JSON.stringify({ garment: { ...JACKET, ...body } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

test("GarmentEditor: cambiar a 'En la lavandería' envía PATCH {availability:'lavanderia'}", async () => {
  const onSaved = vi.fn();
  render(<GarmentEditor garment={JACKET} all={[JACKET, TROUSERS]} onSaved={onSaved} onDeleted={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "En la lavandería" }));
  const [url, init] = lastCall();
  expect(url).toBe("/api/garments?id=j");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(String(init.body))).toEqual({ availability: "lavanderia" });
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ availability: "lavanderia" }));
});

test("vincular traje solo ofrece piezas de traje y envía suitPairId", async () => {
  render(<GarmentEditor garment={JACKET} all={[JACKET, TROUSERS, garment({ id: "x", type: "camisa", description: "camisa" })]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  const select = screen.getByLabelText("Es parte de un traje con");
  expect(Array.from((select as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(["— Ninguna —", "pantalón traje gris"]);
  await userEvent.selectOptions(select, "t");
  expect(JSON.parse(String(lastCall()[1].body))).toEqual({ suitPairId: "t" });
});

test("'Se puede usar suelta' solo aparece en chaquetas de traje", () => {
  const { unmount } = render(<GarmentEditor garment={JACKET} all={[JACKET]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  expect(screen.getByLabelText("Se puede usar suelta")).toBeInTheDocument();
  unmount();
  render(<GarmentEditor garment={TROUSERS} all={[TROUSERS]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  expect(screen.queryByLabelText("Se puede usar suelta")).toBeNull();
});

test("guardar la ficha envía los campos editados", async () => {
  render(<GarmentEditor garment={JACKET} all={[JACKET]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  const desc = screen.getByLabelText("Descripción");
  await userEvent.clear(desc);
  await userEvent.type(desc, "chaqueta gris marengo");
  await userEvent.selectOptions(screen.getByLabelText("Formalidad"), "5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(JSON.parse(String(lastCall()[1].body))).toMatchObject({ description: "chaqueta gris marengo", formality: 5 });
});

test("eliminar pide confirmación y llama a onDeleted", async () => {
  vi.stubGlobal("confirm", () => true);
  fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }));
  const onDeleted = vi.fn();
  render(<GarmentEditor garment={JACKET} all={[JACKET]} onSaved={() => {}} onDeleted={onDeleted} onClose={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(lastCall()[1].method).toBe("DELETE");
  expect(onDeleted).toHaveBeenCalledWith("j");
});

test("una prenda en error tiene 'Reintentar análisis', que vuelve a llamar a tag y guarda el resultado", async () => {
  const failed = garment({ id: "f", status: "error", type: null, error: "Respuesta no válida" });
  fetchMock.mockImplementationOnce(
    async () => new Response(JSON.stringify({ garment: { ...failed, status: "ready", type: "camisa", error: null } }), { status: 200 }),
  );
  const onSaved = vi.fn();
  render(<GarmentEditor garment={failed} all={[failed]} onSaved={onSaved} onDeleted={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Reintentar análisis" }));
  const [url, init] = lastCall();
  expect(url).toBe("/api/garments/tag");
  expect(JSON.parse(String(init.body))).toEqual({ garmentId: "f" });
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: "ready", type: "camisa" }));
  expect(screen.queryByRole("button", { name: "Reintentar análisis" })).toBeNull();
});

test("'Reintentar análisis' con el tope alcanzado muestra el aviso", async () => {
  const failed = garment({ id: "f", status: "error", type: null, error: "Respuesta no válida" });
  fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 402 }));
  render(<GarmentEditor garment={failed} all={[failed]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Reintentar análisis" }));
  expect(await screen.findByText("Has llegado al tope de gasto del mes.")).toBeInTheDocument();
});

test("una prenda lista no muestra 'Reintentar análisis'", () => {
  render(<GarmentEditor garment={JACKET} all={[JACKET]} onSaved={() => {}} onDeleted={() => {}} onClose={() => {}} />);
  expect(screen.queryByRole("button", { name: "Reintentar análisis" })).toBeNull();
});
