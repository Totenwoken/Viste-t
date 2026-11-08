import type { Weather } from "../../shared/outfit";

export interface City {
  name: string;
  lat: number;
  lon: number;
}

const CITY_KEY = "vistet.city";
const CACHE_KEY = "vistet.weather";
const CACHE_MS = 30 * 60 * 1000;

export function wmoLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Despejado", icon: "☀️" };
  if (code >= 1 && code <= 3) return { label: "Nubes y claros", icon: "⛅" };
  if (code === 45 || code === 48) return { label: "Niebla", icon: "🌫️" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Lluvia", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Nieve", icon: "❄️" };
  if (code >= 95 && code <= 99) return { label: "Tormenta", icon: "⛈️" };
  return { label: "—", icon: "" };
}

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,weather_code&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=auto&forecast_days=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();
  const at = (hour: string): number | null => {
    const i = (d.hourly?.time as string[] | undefined)?.findIndex((t) => t.endsWith(`T${hour}`)) ?? -1;
    return i >= 0 ? (d.hourly.temperature_2m[i] as number) : null;
  };
  return {
    tempC: d.current.temperature_2m,
    minC: d.daily.temperature_2m_min[0],
    maxC: d.daily.temperature_2m_max[0],
    rainProb: d.daily.precipitation_probability_max[0] ?? 0,
    ...wmoLabel(d.current.weather_code),
    morningC: at("08:00"),
    eveningC: at("21:00"),
  };
}

export async function geocodeCity(name: string): Promise<City | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=es`);
  if (!res.ok) return null;
  const first = (await res.json()).results?.[0];
  return first ? { name: first.name, lat: first.latitude, lon: first.longitude } : null;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export function saveCity(c: City): void {
  write(CITY_KEY, c);
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nada */
  }
}

export function savedCity(): City | null {
  return read<City>(CITY_KEY);
}

function currentPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

/** Tiempo de hoy: ubicación del móvil, o la ciudad guardada; null si no hay ninguna o falla la red. */
export async function getTodayWeather(): Promise<Weather | null> {
  const cached = read<{ at: number; weather: Weather }>(CACHE_KEY);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.weather;
  try {
    const where = (await currentPosition()) ?? savedCity();
    if (!where) return null;
    const weather = await fetchWeather(where.lat, where.lon);
    write(CACHE_KEY, { at: Date.now(), weather });
    return weather;
  } catch {
    return null;
  }
}
