import { useState, type FormEvent } from "react";
import {
  AVAILABILITY, GARMENT_TYPES, SEASONS, type Garment, type GarmentPatch, type GarmentType, type Season,
} from "../../../shared/garment";
import { apiFetch } from "../../lib/api";
import { AVAILABILITY_LABEL, FORMALITY_LABEL, SEASON_LABEL, TYPE_LABEL } from "./labels";

const SUIT_TYPES: GarmentType[] = ["chaqueta_traje", "pantalon_traje"];

interface Props {
  garment: Garment;
  all: Garment[];
  onSaved(g: Garment): void;
  onDeleted(id: string): void;
  onClose(): void;
}

export function GarmentEditor({ garment, all, onSaved, onDeleted, onClose }: Props) {
  const [type, setType] = useState<GarmentType | "">(garment.type ?? "");
  const [description, setDescription] = useState(garment.description ?? "");
  const [colors, setColors] = useState(garment.colors.join(", "));
  const [formality, setFormality] = useState(garment.formality ?? 3);
  const [seasons, setSeasons] = useState<Season[]>(garment.seasons);
  const [pattern, setPattern] = useState(garment.pattern ?? "");
  const [material, setMaterial] = useState(garment.material ?? "");
  const [current, setCurrent] = useState(garment);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(p: GarmentPatch) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/garments?id=${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error();
      const { garment: saved } = (await res.json()) as { garment: Garment };
      setCurrent(saved);
      onSaved(saved);
    } catch {
      setError("No se ha podido guardar. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!type) {
      setError("Elige el tipo de prenda");
      return;
    }
    await patch({
      type,
      description: description.trim(),
      colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
      formality,
      seasons,
      pattern: pattern.trim() || null,
      material: material.trim() || null,
    });
  }

  async function remove() {
    if (!window.confirm("¿Eliminar esta prenda del armario?")) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/garments?id=${current.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(current.id);
    } catch {
      setError("No se ha podido eliminar.");
      setBusy(false);
    }
  }

  const isSuitPiece = type !== "" && SUIT_TYPES.includes(type);
  const pairCandidates = all.filter(
    (g) => g.id !== current.id && g.type && SUIT_TYPES.includes(g.type) && g.type !== type,
  );

  return (
    <div className="sheet" role="dialog" aria-label="Editar prenda">
      <div className="sheet-head">
        <button type="button" className="btn" onClick={onClose}>← Volver</button>
      </div>
      {current.imageUrl && <img className="sheet-img" src={current.imageUrl} alt="" />}
      {current.status === "error" && <p className="error-text">{current.error}</p>}

      <div className="seg" role="group" aria-label="Disponibilidad">
        {AVAILABILITY.map((a) => (
          <button key={a} type="button" className={current.availability === a ? "on" : undefined} aria-pressed={current.availability === a} disabled={busy} onClick={() => patch({ availability: a })}>
            {AVAILABILITY_LABEL[a]}
          </button>
        ))}
      </div>

      <form onSubmit={save}>
        <label className="field">
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as GarmentType)}>
            <option value="" disabled>Elige…</option>
            {GARMENT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80} />
        </label>
        <label className="field">
          Colores (separados por comas)
          <input value={colors} onChange={(e) => setColors(e.target.value)} />
        </label>
        <label className="field">
          Formalidad
          <select value={formality} onChange={(e) => setFormality(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{`${n} · ${FORMALITY_LABEL[n]}`}</option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend>Estaciones</legend>
          {SEASONS.map((s) => (
            <label key={s} className="check">
              <input
                type="checkbox"
                checked={seasons.includes(s)}
                onChange={(e) => setSeasons(e.target.checked ? [...seasons, s] : seasons.filter((x) => x !== s))}
              />
              {SEASON_LABEL[s]}
            </label>
          ))}
        </fieldset>
        <label className="field">
          Estampado
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="liso, rayas, cuadros…" />
        </label>
        <label className="field">
          Material
          <input value={material} onChange={(e) => setMaterial(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>Guardar</button>
      </form>

      {isSuitPiece && (
        <div className="suit">
          <label className="field">
            Es parte de un traje con
            <select value={current.suitPairId ?? ""} disabled={busy} onChange={(e) => patch({ suitPairId: e.target.value || null })}>
              <option value="">— Ninguna —</option>
              {pairCandidates.map((g) => (
                <option key={g.id} value={g.id}>{g.description ?? TYPE_LABEL[g.type!]}</option>
              ))}
            </select>
          </label>
          {type === "chaqueta_traje" && (
            <label className="check">
              <input type="checkbox" checked={current.jacketCombinable} disabled={busy} onChange={(e) => patch({ jacketCombinable: e.target.checked })} />
              Se puede usar suelta
            </label>
          )}
        </div>
      )}

      <button type="button" className="btn danger" onClick={remove} disabled={busy}>Eliminar</button>
    </div>
  );
}
