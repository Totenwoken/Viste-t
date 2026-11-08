import { layerOf, type Garment } from "../../../shared/garment";

interface Props {
  garments: Garment[];
  lockedIds: string[];
  /** Prenda recién añadida con "Añadir capa". */
  addedId?: string | null;
  onToggleLock(id: string): void;
  onSelect(id: string): void;
}

/** Disposición tipo "flat lay": izquierda capa exterior y torso, derecha pantalón, abajo calzado. */
export function collageSlots(garments: Garment[]) {
  const of = (...layers: string[]) => garments.filter((g) => g.type && layers.includes(layerOf(g.type)));
  return { outer: of("outer"), upper: of("mid", "top"), bottom: of("bottom"), shoes: of("shoes") };
}

function Piece({ g, locked, added, onToggleLock, onSelect }: { g: Garment; locked: boolean; added: boolean; onToggleLock(): void; onSelect(): void }) {
  const name = g.description ?? "prenda";
  return (
    <div className={added ? "piece added" : "piece"}>
      {added && <span className="added-badge">Nueva</span>}
      <button type="button" className="piece-img" onClick={onSelect}>
        {g.imageUrl ? <img src={g.imageUrl} alt={name} crossOrigin="anonymous" /> : <span>{name}</span>}
      </button>
      <button
        type="button"
        className={locked ? "lock on" : "lock"}
        aria-label={`${locked ? "Desbloquear" : "Bloquear"} ${name}`}
        aria-pressed={locked}
        onClick={onToggleLock}
      >
        {locked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}

export function OutfitCollage({ garments, lockedIds, addedId, onToggleLock, onSelect }: Props) {
  const slots = collageSlots(garments);
  const render = (list: Garment[]) =>
    list.map((g) => (
      <Piece key={g.id} g={g} locked={lockedIds.includes(g.id)} added={g.id === addedId} onToggleLock={() => onToggleLock(g.id)} onSelect={() => onSelect(g.id)} />
    ));
  return (
    <div className="collage">
      <div className="collage-left">
        {render(slots.outer)}
        {render(slots.upper)}
      </div>
      <div className="collage-right">{render(slots.bottom)}</div>
      <div className="collage-shoes">{render(slots.shoes)}</div>
    </div>
  );
}
