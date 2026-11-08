import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InicioScreen } from "./InicioScreen";

const weather = { tempC: 14.4, minC: 9, maxC: 17, rainProb: 10, label: "Nubes y claros", icon: "⛅" };
const mocks = vi.hoisted(() => ({
  getTodayWeather: vi.fn(),
  geocodeCity: vi.fn(),
  saveCity: vi.fn(),
}));
vi.mock("../lib/weather", () => mocks);

beforeEach(() => {
  mocks.getTodayWeather.mockReset().mockResolvedValue(weather);
  mocks.geocodeCity.mockReset();
  mocks.saveCity.mockReset();
});

test("el botón principal pide un conjunto automático con el tiempo", async () => {
  const onRequest = vi.fn();
  render(<InicioScreen onRequest={onRequest} />);
  await screen.findByText(/14°C/);
  await userEvent.click(screen.getByRole("button", { name: /¿Qué me pongo hoy\?/ }));
  expect(onRequest).toHaveBeenCalledWith({ mode: "auto", request: null, weather });
});

test("cada botón de estilo pide su modo", async () => {
  const onRequest = vi.fn();
  render(<InicioScreen onRequest={onRequest} />);
  const cases: [RegExp, string][] = [[/^Vaqueros$/, "vaqueros"], [/^Formal$/, "formal"], [/Formal traje/, "traje"], [/Chinos/, "chinos"]];
  for (const [name, mode] of cases) {
    await userEvent.click(screen.getByRole("button", { name }));
    expect(onRequest).toHaveBeenLastCalledWith(expect.objectContaining({ mode, request: null }));
  }
});

test("la barra de texto envía el pedido recortado y no se envía vacía", async () => {
  const onRequest = vi.fn();
  render(<InicioScreen onRequest={onRequest} />);
  const send = screen.getByRole("button", { name: "Montar conjunto" });
  expect(send).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Quiero ponerme…"), "  camiseta básica blanca  ");
  await userEvent.click(send);
  expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ mode: "auto", request: "camiseta básica blanca" }));
});

test("muestra la temperatura y el estado cuando hay tiempo", async () => {
  render(<InicioScreen onRequest={() => {}} />);
  expect(await screen.findByText("14°C ⛅ Nubes y claros")).toBeInTheDocument();
});

test("sin tiempo ofrece 'Añadir ciudad' y permite guardarla", async () => {
  mocks.getTodayWeather.mockResolvedValueOnce(null).mockResolvedValueOnce(weather);
  mocks.geocodeCity.mockResolvedValue({ name: "Sevilla", lat: 37.38, lon: -5.98 });
  render(<InicioScreen onRequest={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Añadir ciudad" }));
  await userEvent.type(screen.getByLabelText("Ciudad"), "sevilla");
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Usar Sevilla" }));
  expect(mocks.saveCity).toHaveBeenCalledWith({ name: "Sevilla", lat: 37.38, lon: -5.98 });
  expect(await screen.findByText("14°C ⛅ Nubes y claros")).toBeInTheDocument();
});

test("muestra la fecha de hoy en español", () => {
  render(<InicioScreen onRequest={() => {}} />);
  const today = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  expect(screen.getByText(new RegExp(today, "i"))).toBeInTheDocument();
});

test("muestra la mínima y la máxima del día", async () => {
  render(<InicioScreen onRequest={() => {}} />);
  expect(await screen.findByText("9°–17°")).toBeInTheDocument();
});
