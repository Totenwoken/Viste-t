import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

const api = vi.hoisted(() => ({ generateOutfit: vi.fn(), wearOutfit: vi.fn(), rejectOutfit: vi.fn(), wearOther: vi.fn(), listGarments: vi.fn() }));
vi.mock("./lib/outfitsApi", async (orig) => ({ ...(await orig<typeof import("./lib/outfitsApi")>()), ...api }));
vi.mock("./lib/weather", () => ({ getTodayWeather: vi.fn(async () => null), geocodeCity: vi.fn(), saveCity: vi.fn() }));
vi.mock("./screens/armario/ArmarioScreen", () => ({ ArmarioScreen: () => <p>ARMARIO</p> }));

test("cambiar de pestaña y volver no vuelve a generar el conjunto", async () => {
  api.generateOutfit.mockResolvedValue({
    outfit: { id: "o1", mode: "auto", request: null, garmentIds: [], lockedIds: [], explanation: "Explicación o1", status: "proposed", rejectReason: null, wornOn: null, createdAt: "", notes: [] },
    garments: [],
  });
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /¿Qué me pongo hoy\?/ }));
  await screen.findByText("Explicación o1");
  await userEvent.click(screen.getByRole("button", { name: /Armario/ }));
  expect(screen.getByText("ARMARIO")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Inicio/ }));
  expect(await screen.findByText("Explicación o1")).toBeVisible();
  expect(api.generateOutfit).toHaveBeenCalledTimes(1);
});
