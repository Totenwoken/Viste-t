import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutfitScreen } from "./OutfitScreen";
import { BudgetExceededError } from "../../lib/api";
import type { Garment, GarmentType } from "../../../shared/garment";
import type { Outfit } from "../../../shared/outfit";

const api = vi.hoisted(() => ({
  generateOutfit: vi.fn(),
  wearOutfit: vi.fn(),
  rejectOutfit: vi.fn(),
  wearOther: vi.fn(),
  listGarments: vi.fn(),
}));
vi.mock("../../lib/outfitsApi", async (orig) => ({ ...(await orig<typeof import("../../lib/outfitsApi")>()), ...api }));
import { OutfitError } from "../../lib/outfitsApi";

const g = (id: string, type: GarmentType, description: string): Garment => ({
  id, status: "ready", type, description, colors: [], formality: 3, seasons: [], pattern: null, material: null,
  availability: "disponible", suitPairId: null, jacketCombinable: false, error: null, imageUrl: `https://img/${id}`,
  createdAt: "2026-11-08T10:00:00Z",
});
const shirt = g("c", "camisa", "camisa blanca"), chino = g("p", "pantalon_chino", "chino verde"), shoes = g("z", "calzado", "zapatillas blancas");
const boots = g("z2", "calzado", "botines marrones");
const outfit = (id: string, ids: string[], over: Partial<Outfit> = {}): Outfit => ({
  id, mode: "auto", request: null, garmentIds: ids, lockedIds: [], explanation: `Explicación ${id}`, status: "proposed",
  rejectReason: null, wornOn: null, createdAt: "2026-11-08T10:00:00Z", notes: [], ...over,
});
const request = { mode: "auto" as const, request: null, weather: null };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.generateOutfit.mockResolvedValueOnce({ outfit: outfit("o1", ["c", "p", "z"]), garments: [shirt, chino, shoes] });
  api.wearOutfit.mockResolvedValue({ outfit: outfit("o1", ["c", "p", "z"], { status: "worn" }) });
  api.rejectOutfit.mockResolvedValue({});
  api.wearOther.mockResolvedValue({});
});

test("al montarse pide el conjunto y lo muestra con su explicación", async () => {
  render(<OutfitScreen request={request} onBack={() => {}} />);
  expect(screen.getByText("Montando tu conjunto…")).toBeInTheDocument();
  expect(await screen.findByText("Explicación o1")).toBeInTheDocument();
  expect(api.generateOutfit).toHaveBeenCalledWith({ mode: "auto", weather: null });
  expect(screen.getByRole("img", { name: "chino verde" })).toBeInTheDocument();
});

test("las prendas pedidas salen bloqueadas y las notas se muestran", async () => {
  api.generateOutfit.mockReset().mockResolvedValueOnce({
    outfit: outfit("o1", ["c", "p", "z"], { lockedIds: ["p"], notes: ["No he encontrado «zapatillas rojas» en tu armario"] }),
    garments: [shirt, chino, shoes],
  });
  render(<OutfitScreen request={{ ...request, request: "chino verde" }} onBack={() => {}} />);
  expect(await screen.findByText("No he encontrado «zapatillas rojas» en tu armario")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Desbloquear chino verde" })).toBeInTheDocument();
  expect(api.generateOutfit).toHaveBeenCalledWith({ mode: "auto", request: "chino verde", weather: null });
});

test("'Otro' mantiene las prendas bloqueadas y rechaza el anterior", async () => {
  api.generateOutfit.mockResolvedValueOnce({ outfit: outfit("o2", ["c", "p", "z2"]), garments: [shirt, chino, boots] });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Bloquear camisa blanca" }));
  await userEvent.click(screen.getByRole("button", { name: "Otro ↻" }));
  expect(await screen.findByText("Explicación o2")).toBeInTheDocument();
  expect(api.generateOutfit).toHaveBeenLastCalledWith({ mode: "auto", weather: null, lockedIds: ["c"], previousOutfitId: "o1" });
  expect(api.rejectOutfit).toHaveBeenCalledWith("o1");
});

test("un motivo tras 'Otro' se envía como feedback del conjunto anterior", async () => {
  api.generateOutfit.mockResolvedValueOnce({ outfit: outfit("o2", ["c", "p", "z2"]), garments: [shirt, chino, boots] });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Otro ↻" }));
  await screen.findByText("¿Por qué no te gustó el anterior?");
  await userEvent.click(screen.getByRole("button", { name: "colores" }));
  expect(api.rejectOutfit).toHaveBeenLastCalledWith("o1", "colores");
  expect(screen.queryByText("¿Por qué no te gustó el anterior?")).toBeNull();
});

test("'Cambiar solo esta' envía replaceId y previousOutfitId", async () => {
  api.generateOutfit.mockResolvedValueOnce({ outfit: outfit("o2", ["c", "p", "z2"]), garments: [shirt, chino, boots] });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "zapatillas blancas" }));
  await userEvent.click(screen.getByRole("button", { name: "Cambiar solo esta" }));
  expect(await screen.findByText("Explicación o2")).toBeInTheDocument();
  expect(api.generateOutfit).toHaveBeenLastCalledWith({ mode: "auto", weather: null, previousOutfitId: "o1", replaceId: "z", lockedIds: [] });
});

test("'Me lo pongo' registra el conjunto y muestra la confirmación", async () => {
  const onBack = vi.fn();
  render(<OutfitScreen request={request} onBack={onBack} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Me lo pongo ✓" }));
  expect(api.wearOutfit).toHaveBeenCalledWith("o1");
  expect(await screen.findByText("¡Listo! Que tengas un buen día")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Volver" }));
  expect(onBack).toHaveBeenCalled();
});

test("con el tope alcanzado al pulsar 'Otro' se muestra el aviso y se mantiene el conjunto", async () => {
  api.generateOutfit.mockRejectedValueOnce(new BudgetExceededError());
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Otro ↻" }));
  expect(await screen.findByText("Has llegado al tope de gasto del mes")).toBeInTheDocument();
  expect(screen.getByText("Explicación o1")).toBeInTheDocument();
  expect(api.rejectOutfit).not.toHaveBeenCalled();
});

test("422 not_enough muestra el mensaje del servidor", async () => {
  api.generateOutfit.mockReset().mockRejectedValueOnce(new OutfitError("not_enough", "No tienes vaqueros disponibles"));
  const onBack = vi.fn();
  render(<OutfitScreen request={{ ...request, mode: "vaqueros" }} onBack={onBack} />);
  expect(await screen.findByText("No tienes vaqueros disponibles")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Volver" }));
  expect(onBack).toHaveBeenCalled();
});

test("'Me puse otra cosa' guarda las prendas elegidas", async () => {
  api.listGarments.mockResolvedValue([shirt, chino, shoes, boots, g("acc", "complemento", "reloj")]);
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Me puse otra cosa" }));
  const picker = await screen.findByRole("dialog", { name: "¿Qué te has puesto?" });
  expect(within(picker).queryByText("reloj")).toBeNull();
  await userEvent.click(within(picker).getByRole("button", { name: /camisa blanca/ }));
  await userEvent.click(within(picker).getByRole("button", { name: /botines marrones/ }));
  await userEvent.click(within(picker).getByRole("button", { name: "Guardar" }));
  expect(api.wearOther).toHaveBeenCalledWith(["c", "z2"]);
  expect(await screen.findByText("¡Listo! Que tengas un buen día")).toBeInTheDocument();
});

const img = vi.hoisted(() => ({ renderCollage: vi.fn(), shareOrDownload: vi.fn() }));
vi.mock("../../lib/collageImage", () => img);

test("'Guardar imagen' compone el collage y lo comparte", async () => {
  const blob = new Blob(["x"], { type: "image/png" });
  img.renderCollage.mockResolvedValue(blob);
  img.shareOrDownload.mockResolvedValue(undefined);
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  expect(img.renderCollage).toHaveBeenCalledWith([shirt, chino, shoes]);
  expect(img.shareOrDownload).toHaveBeenCalledWith(blob);
});

test("si no se puede crear la imagen, se avisa", async () => {
  img.renderCollage.mockRejectedValue(new Error("tainted"));
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  expect(await screen.findByText("No se ha podido crear la imagen")).toBeInTheDocument();
});

test("si 'Cambiar solo esta' falla por el tope, se avisa y se mantiene el conjunto", async () => {
  api.generateOutfit.mockRejectedValueOnce(new BudgetExceededError());
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "zapatillas blancas" }));
  await userEvent.click(screen.getByRole("button", { name: "Cambiar solo esta" }));
  expect(await screen.findByText("Has llegado al tope de gasto del mes")).toBeInTheDocument();
  expect(screen.getByText("Explicación o1")).toBeInTheDocument();
});

test("'Cambiar solo esta' envía también los candados del usuario (sin la prenda a cambiar)", async () => {
  api.generateOutfit.mockResolvedValueOnce({ outfit: outfit("o2", ["c", "p", "z2"]), garments: [shirt, chino, boots] });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Bloquear camisa blanca" }));
  await userEvent.click(screen.getByRole("button", { name: "zapatillas blancas" }));
  await userEvent.click(screen.getByRole("button", { name: "Cambiar solo esta" }));
  await screen.findByText("Explicación o2");
  expect(api.generateOutfit).toHaveBeenLastCalledWith({ mode: "auto", weather: null, previousOutfitId: "o1", replaceId: "z", lockedIds: ["c"] });
});

test("las fotos del collage se piden con crossOrigin para poder exportarlas", async () => {
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  expect(screen.getByRole("img", { name: "chino verde" })).toHaveAttribute("crossorigin", "anonymous");
});

test("si iOS no deja compartir tras preparar la imagen, ofrece un botón para compartirla ya preparada", async () => {
  const blob = new Blob(["x"], { type: "image/png" });
  img.renderCollage.mockResolvedValue(blob);
  img.shareOrDownload.mockReset().mockRejectedValueOnce(new DOMException("no gesture", "NotAllowedError")).mockResolvedValueOnce(undefined);
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen" }));
  await userEvent.click(await screen.findByRole("button", { name: "Compartir imagen" }));
  expect(img.shareOrDownload).toHaveBeenCalledTimes(2);
  expect(img.shareOrDownload).toHaveBeenLastCalledWith(blob);
});

const overshirt = g("sc", "sobrecamisa", "sobrecamisa verde");

test("'Añadir capa' mantiene el conjunto, pide una capa y marca la prenda nueva", async () => {
  api.generateOutfit.mockResolvedValueOnce({
    outfit: outfit("o2", ["c", "sc", "p", "z"], { addedId: "sc" }),
    garments: [shirt, overshirt, chino, shoes],
  });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Bloquear chino verde" }));
  await userEvent.click(screen.getByRole("button", { name: "Añadir capa" }));
  expect(await screen.findByText("Explicación o2")).toBeInTheDocument();
  expect(api.generateOutfit).toHaveBeenLastCalledWith({ mode: "auto", weather: null, addLayerTo: "o1", lockedIds: ["p"] });
  expect(screen.getByText("Nueva")).toBeInTheDocument();
  expect(api.rejectOutfit).not.toHaveBeenCalled();
  expect(screen.queryByText("¿Por qué no te gustó el anterior?")).toBeNull();
});

test("'Añadir capa' no aparece si el conjunto ya lleva jersey y prenda de fuera", async () => {
  api.generateOutfit.mockReset().mockResolvedValueOnce({
    outfit: outfit("o1", ["j", "sc", "p", "z"]),
    garments: [g("j", "jersey", "jersey crema"), overshirt, chino, shoes],
  });
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  expect(screen.queryByRole("button", { name: "Añadir capa" })).toBeNull();
});

test("si 'Añadir capa' falla, se avisa y se mantiene el conjunto", async () => {
  api.generateOutfit.mockRejectedValueOnce(new OutfitError("not_enough", "No tienes jerséis ni chaquetas disponibles para añadir"));
  render(<OutfitScreen request={request} onBack={() => {}} />);
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: "Añadir capa" }));
  expect(await screen.findByText("No tienes jerséis ni chaquetas disponibles para añadir")).toBeInTheDocument();
  expect(screen.getByText("Explicación o1")).toBeInTheDocument();
});
