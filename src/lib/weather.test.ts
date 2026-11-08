import { fetchWeather, geocodeCity, getTodayWeather, saveCity, wmoLabel } from "./weather";

const openMeteo = {
  current: { temperature_2m: 14.4, weather_code: 2 },
  daily: { temperature_2m_max: [17.2], temperature_2m_min: [8.6], precipitation_probability_max: [20] },
};

function stubGeolocation(ok: boolean) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) =>
        ok
          ? success({ coords: { latitude: 40.4, longitude: -3.7 } } as GeolocationPosition)
          : failure({ code: 1, message: "denied" } as GeolocationPositionError),
    },
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

test("wmoLabel traduce los códigos principales", () => {
  expect(wmoLabel(0)).toEqual({ label: "Despejado", icon: "☀️" });
  expect(wmoLabel(2)).toEqual({ label: "Nubes y claros", icon: "⛅" });
  expect(wmoLabel(61).label).toBe("Lluvia");
  expect(wmoLabel(81).label).toBe("Lluvia");
  expect(wmoLabel(73).label).toBe("Nieve");
  expect(wmoLabel(95).label).toBe("Tormenta");
  expect(wmoLabel(45).label).toBe("Niebla");
  expect(wmoLabel(999).label).toBe("—");
});

test("fetchWeather mapea la respuesta de Open-Meteo a Weather", async () => {
  const fetchMock = vi.fn(async (_u: string) => new Response(JSON.stringify(openMeteo)));
  vi.stubGlobal("fetch", fetchMock);
  expect(await fetchWeather(40.4, -3.7)).toEqual({ tempC: 14.4, minC: 8.6, maxC: 17.2, rainProb: 20, label: "Nubes y claros", icon: "⛅" });
  expect(fetchMock.mock.calls[0][0]).toContain("latitude=40.4");
});

test("geocodeCity devuelve la primera coincidencia o null", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{ name: "Sevilla", latitude: 37.38, longitude: -5.98 }] }))));
  expect(await geocodeCity("sevilla")).toEqual({ name: "Sevilla", lat: 37.38, lon: -5.98 });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  expect(await geocodeCity("xyz")).toBeNull();
});

test("getTodayWeather usa la ubicación del móvil si se permite", async () => {
  stubGeolocation(true);
  const fetchMock = vi.fn(async (_u: string) => new Response(JSON.stringify(openMeteo)));
  vi.stubGlobal("fetch", fetchMock);
  expect((await getTodayWeather())?.tempC).toBe(14.4);
  expect(fetchMock.mock.calls[0][0]).toContain("latitude=40.4");
});

test("getTodayWeather usa la ciudad guardada si se deniega la ubicación", async () => {
  stubGeolocation(false);
  saveCity({ name: "Sevilla", lat: 37.38, lon: -5.98 });
  const fetchMock = vi.fn(async (_u: string) => new Response(JSON.stringify(openMeteo)));
  vi.stubGlobal("fetch", fetchMock);
  expect(await getTodayWeather()).not.toBeNull();
  expect(fetchMock.mock.calls[0][0]).toContain("latitude=37.38");
});

test("getTodayWeather devuelve null sin ubicación ni ciudad, o si falla la red", async () => {
  stubGeolocation(false);
  expect(await getTodayWeather()).toBeNull();
  saveCity({ name: "Sevilla", lat: 37.38, lon: -5.98 });
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  }));
  expect(await getTodayWeather()).toBeNull();
});

test("usa la caché de 30 minutos", async () => {
  stubGeolocation(true);
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(openMeteo)));
  vi.stubGlobal("fetch", fetchMock);
  await getTodayWeather();
  await getTodayWeather();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
