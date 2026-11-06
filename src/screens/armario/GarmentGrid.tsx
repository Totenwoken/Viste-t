import { useState } from "react";
import { AVAILABILITY, layerOf, type Availability, type Garment } from "../../../shared/garment";
import { AVAILABILITY_LABEL, LAYER_LABEL, LAYER_ORDER, TYPE_LABEL } from "./labels";

type Filter = "todas" | Availability;

function Tile({ g, onSelect }: { g: Garment; onSelect(g: Garment): void }) {
  const name = g.description ?? (g.type ? TYPE_LABEL[g.type] : "Prenda");
  const cls = ["tile", g.availability !== "disponible" ? "unavailable" : "", g.status === "error" ? "has-error" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} onClick={() => onSelect(g)}>
      {g.imageUrl ? <img src={g.imageUrl} alt="" loading="lazy" /> : <span className="tile-ph" aria-hidden="true" />}
      <span className="tile-name">{name}</span>
      {g.status === "error" && <span className="tile-error">{g.error ?? "Revisar"}</span>}
      {g.availability !== "disponible" && <span className="tile-badge">{AVAILABILITY_LABEL[g.availability]}</span>}
    </button>
  );
}

function Section({ title, items, onSelect }: { title: string; items: Garment[]; onSelect(g: Garment): void }) {
  if (items.length === 0) return null;
  const id = `sec-${title}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="grid">
        {items.map((g) => (
          <Tile key={g.id} g={g} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export function GarmentGrid({ garments, onSelect }: { garments: Garment[]; onSelect(g: Garment): void }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const visible = filter === "todas" ? garments : garments.filter((g) => g.availability === filter);

  const errors = visible.filter((g) => g.status === "error");
  const pending = visible.filter((g) => g.status === "pending");
  const ready = visible.filter((g) => g.status === "ready" && g.type);

  return (
    <div className="garment-grid">
      <div className="chips" role="group" aria-label="Filtrar por disponibilidad">
        {(["todas", ...AVAILABILITY] as Filter[]).map((f) => (
          <button key={f} type="button" className={f === filter ? "chip on" : "chip"} aria-pressed={f === filter} onClick={() => setFilter(f)}>
            {f === "todas" ? "Todas" : AVAILABILITY_LABEL[f]}
          </button>
        ))}
      </div>
      <Section title="Revisar" items={errors} onSelect={onSelect} />
      <Section title="Procesando" items={pending} onSelect={onSelect} />
      {LAYER_ORDER.map((layer) => (
        <Section key={layer} title={LAYER_LABEL[layer]} items={ready.filter((g) => layerOf(g.type!) === layer)} onSelect={onSelect} />
      ))}
    </div>
  );
}
