import { useEffect, useRef, useState } from "react";
import type { Garment } from "../../../shared/garment";
import { REJECT_REASONS, type Outfit, type RejectReason } from "../../../shared/outfit";
import { BudgetExceededError } from "../../lib/api";
import { generateOutfit, OutfitError, rejectOutfit, wearOther, wearOutfit, type GenerateBody } from "../../lib/outfitsApi";
import type { OutfitRequest } from "../InicioScreen";
import { OutfitCollage } from "./OutfitCollage";
import { WearOtherPicker } from "./WearOtherPicker";

interface Props {
  request: OutfitRequest;
  onBack(): void;
}

type Phase = "loading" | "ready" | "worn" | "failed";

function messageFor(e: unknown): string {
  if (e instanceof BudgetExceededError) return "Has llegado al tope de gasto del mes";
  if (e instanceof OutfitError) return e.message;
  return "No se ha podido montar el conjunto. Inténtalo de nuevo.";
}

export function OutfitScreen({ request, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askReasonFor, setAskReasonFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickingOther, setPickingOther] = useState(false);
  const started = useRef(false);

  const base: GenerateBody = { mode: request.mode, weather: request.weather, ...(request.request ? { request: request.request } : {}) };

  async function generate(extra: Partial<GenerateBody>, previous: Outfit | null) {
    setBusy(true);
    setError(null);
    setSelected(null);
    try {
      const res = await generateOutfit({ ...base, ...extra });
      setOutfit(res.outfit);
      setGarments(res.garments);
      setLocked(res.outfit.lockedIds);
      setPhase("ready");
      if (previous) {
        setAskReasonFor(previous.id);
        void rejectOutfit(previous.id).catch(() => {});
      } else {
        setAskReasonFor(null);
      }
    } catch (e) {
      setError(messageFor(e));
      if (!previous) setPhase("failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void generate({}, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLock = (id: string) => setLocked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function another() {
    if (!outfit) return;
    await generate({ lockedIds: locked, previousOutfitId: outfit.id }, outfit);
  }

  async function swapOne(id: string) {
    if (!outfit) return;
    await generate({ previousOutfitId: outfit.id, replaceId: id }, null);
  }

  async function wear() {
    if (!outfit) return;
    setBusy(true);
    try {
      await wearOutfit(outfit.id);
      setPhase("worn");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveOther(ids: string[]) {
    try {
      await wearOther(ids);
      setPickingOther(false);
      setPhase("worn");
    } catch (e) {
      setError(messageFor(e));
    }
  }

  function sendReason(reason: RejectReason) {
    if (askReasonFor) void rejectOutfit(askReasonFor, reason).catch(() => {});
    setAskReasonFor(null);
  }

  if (pickingOther) return <WearOtherPicker onSave={saveOther} onCancel={() => setPickingOther(false)} />;

  if (phase === "loading") return <p className="muted center">Montando tu conjunto…</p>;

  if (phase === "failed") {
    return (
      <section>
        <p className="error-text">{error}</p>
        <button type="button" className="btn" onClick={onBack}>Volver</button>
      </section>
    );
  }

  if (phase === "worn") {
    return (
      <section className="center">
        <h1>¡Listo! Que tengas un buen día</h1>
        <button type="button" className="btn primary" onClick={onBack}>Volver</button>
      </section>
    );
  }

  const selectedGarment = garments.find((g) => g.id === selected);
  return (
    <section className="outfit">
      <button type="button" className="link back" onClick={onBack}>← Inicio</button>
      {request.request && <p className="muted">{`Con: ${request.request}`}</p>}

      <OutfitCollage garments={garments} lockedIds={locked} onToggleLock={toggleLock} onSelect={(id) => setSelected(id === selected ? null : id)} />

      {selectedGarment && (
        <div className="piece-menu" role="group" aria-label={`Opciones de ${selectedGarment.description}`}>
          <strong>{selectedGarment.description}</strong>
          <div className="row-actions">
            <button type="button" className="btn" disabled={busy} onClick={() => swapOne(selectedGarment.id)}>Cambiar solo esta</button>
            <button type="button" className="btn" onClick={() => toggleLock(selectedGarment.id)}>
              {locked.includes(selectedGarment.id) ? "Desbloquear" : "Bloquear"}
            </button>
          </div>
        </div>
      )}

      {outfit?.notes.map((n) => (
        <p key={n} className="note">{n}</p>
      ))}
      <p className="why">
        <span aria-hidden="true">💬 </span>
        <span>{outfit?.explanation}</span>
      </p>
      {error && <p className="error-text">{error}</p>}

      <div className="outfit-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={wear}>Me lo pongo ✓</button>
        <button type="button" className="btn" disabled={busy} onClick={another}>Otro ↻</button>
      </div>
      {busy && <p className="muted">Montando otro…</p>}

      {askReasonFor && (
        <div className="reasons">
          <p className="muted">¿Por qué no te gustó el anterior?</p>
          <div className="chips">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" className="chip" onClick={() => sendReason(r)}>{r}</button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="link" onClick={() => setPickingOther(true)}>Me puse otra cosa</button>
    </section>
  );
}
