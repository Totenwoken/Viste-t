import { useState, type FormEvent } from "react";
import { geocodeCity, saveCity, type City } from "../../lib/weather";

/** Ciudad para el tiempo cuando el móvil no da su ubicación. */
export function CityPicker({ onSaved, onCancel }: { onSaved(): void; onCancel(): void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<City | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFound(null);
    try {
      const city = await geocodeCity(query.trim());
      if (city) setFound(city);
      else setError("No encuentro esa ciudad");
    } catch {
      setError("Sin conexión. Inténtalo de nuevo.");
    }
  }

  return (
    <form className="city-picker" onSubmit={search}>
      <label className="field">
        Ciudad
        <input value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="address-level2" />
      </label>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={!query.trim()}>Buscar</button>
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {found && (
        <button
          className="btn primary"
          type="button"
          onClick={() => {
            saveCity(found);
            onSaved();
          }}
        >
          {`Usar ${found.name}`}
        </button>
      )}
    </form>
  );
}
