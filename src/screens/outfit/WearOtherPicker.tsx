import { useEffect, useState } from "react";
import { layerOf, type Garment } from "../../../shared/garment";
import { listGarments } from "../../lib/outfitsApi";
import { LAYER_LABEL, LAYER_ORDER } from "../armario/labels";

interface Props {
  onSave(ids: string[]): Promise<void> | void;
  onCancel(): void;
}

/** "Me puse otra cosa": elegir del armario lo que se puso de verdad. */
export function WearOtherPicker({ onSave, onCancel }: Props) {
  const [garments, setGarments] = useState<Garment[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGarments()
      .then((list) => setGarments(list.filter((g) => g.status === "ready" && g.type && g.type !== "complemento")))
      .catch(() => setError("No se ha podido cargar el armario."));
  }, []);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="sheet" role="dialog" aria-label="¿Qué te has puesto?">
      <h2>¿Qué te has puesto?</h2>
      {error && <p className="error-text">{error}</p>}
      {!garments && !error && <p className="muted">Cargando…</p>}
      {garments &&
        LAYER_ORDER.filter((l) => l !== "accessory").map((layer) => {
          const items = garments.filter((g) => layerOf(g.type!) === layer);
          if (!items.length) return null;
          return (
            <section key={layer}>
              <h3 className="muted">{LAYER_LABEL[layer]}</h3>
              <div className="grid">
                {items.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={selected.includes(g.id) ? "tile selected" : "tile"}
                    aria-pressed={selected.includes(g.id)}
                    onClick={() => toggle(g.id)}
                  >
                    {g.imageUrl ? <img src={g.imageUrl} alt="" loading="lazy" /> : <span className="tile-ph" aria-hidden="true" />}
                    <span className="tile-name">{g.description}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      <div className="row-actions sticky-actions">
        <button
          type="button"
          className="btn primary"
          disabled={selected.length === 0}
          onClick={() => void onSave(garments!.filter((g) => selected.includes(g.id)).map((g) => g.id))}
        >
          Guardar
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
