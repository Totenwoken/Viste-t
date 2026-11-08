import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { OutfitMode, Weather } from "../../shared/outfit";
import { getTodayWeather } from "../lib/weather";
import { CityPicker } from "./inicio/CityPicker";

export interface OutfitRequest {
  mode: OutfitMode;
  request: string | null;
  weather: Weather | null;
}

const STYLES: { mode: OutfitMode; icon: string; label: string }[] = [
  { mode: "vaqueros", icon: "👖", label: "Vaqueros" },
  { mode: "formal", icon: "👔", label: "Formal" },
  { mode: "traje", icon: "🤵", label: "Formal traje" },
  { mode: "chinos", icon: "🩳", label: "Chinos" },
];

const todayLabel = () =>
  new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export function InicioScreen({ onRequest }: { onRequest(r: OutfitRequest): void }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [pickingCity, setPickingCity] = useState(false);
  const [text, setText] = useState("");

  const loadWeather = useCallback(async () => {
    setWeather(await getTodayWeather());
    setWeatherLoaded(true);
  }, []);

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  const ask = (mode: OutfitMode, request: string | null = null) => onRequest({ mode, request, weather });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) ask("auto", text.trim());
  }

  return (
    <section className="inicio">
      <p className="inicio-top">
        <span className="capitalize">{todayLabel()}</span>
        {weather && (
          <>
            {" · "}
            <span>{`${Math.round(weather.tempC)}°C ${weather.icon} ${weather.label}`}</span>
          </>
        )}
        {weatherLoaded && !weather && !pickingCity && (
          <>
            {" · "}
            <button type="button" className="link" onClick={() => setPickingCity(true)}>Añadir ciudad</button>
          </>
        )}
      </p>
      {pickingCity && (
        <CityPicker
          onCancel={() => setPickingCity(false)}
          onSaved={() => {
            setPickingCity(false);
            void loadWeather();
          }}
        />
      )}

      <h1>Hola</h1>

      <button type="button" className="big-cta" onClick={() => ask("auto")}>
        ¿Qué me pongo hoy?
        <small>Te monto un conjunto con tu armario</small>
      </button>

      <div className="style-grid">
        {STYLES.map((s) => (
          <button key={s.mode} type="button" className="style-chip" onClick={() => ask(s.mode)}>
            <span aria-hidden="true">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      <form className="ask-bar" onSubmit={submit}>
        <span aria-hidden="true">✏️</span>
        <input
          aria-label="Quiero ponerme…"
          placeholder="Quiero ponerme… camiseta básica blanca"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
        />
        <button type="submit" aria-label="Montar conjunto" disabled={!text.trim()}>→</button>
      </form>
    </section>
  );
}
