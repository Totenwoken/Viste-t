import { useCallback, useEffect, useRef, useState } from "react";
import type { Garment } from "../../../shared/garment";
import { apiFetch } from "../../lib/api";
import { getUploadQueue, type UploadQueue } from "../../lib/uploadQueue";
import { GarmentEditor } from "./GarmentEditor";
import { GarmentGrid } from "./GarmentGrid";
import { UploadPanel } from "./UploadPanel";
import { mergeGarments } from "./mergeGarments";

const URL_REUSE_MS = 45 * 60 * 1000;

export function ArmarioScreen({ queue = getUploadQueue() }: { queue?: UploadQueue }) {
  const [garments, setGarments] = useState<Garment[] | null>(null);
  const [selected, setSelected] = useState<Garment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastDone = useRef(0);
  const urlsAt = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/garments");
      if (!res.ok) throw new Error();
      const next = ((await res.json()) as { garments: Garment[] }).garments;
      // Las URL firmadas valen 1 h: se reutilizan durante 45 min y luego se renuevan todas.
      const keepUrls = Date.now() - urlsAt.current < URL_REUSE_MS;
      if (!keepUrls) urlsAt.current = Date.now();
      setGarments((prev) => mergeGarments(prev, next, keepUrls));
      setError(null);
    } catch {
      setError("No se ha podido cargar el armario.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recarga la lista cada vez que la cola termina una prenda.
  const onProgress = useCallback(() => {
    const done = queue.items().filter((i) => i.status === "done").length;
    if (done !== lastDone.current) {
      lastDone.current = done;
      void load();
    }
  }, [queue, load]);

  if (selected && garments) {
    return (
      <GarmentEditor
        garment={selected}
        all={garments}
        onSaved={(g) => setGarments((list) => list?.map((x) => (x.id === g.id ? g : x)) ?? null)}
        onDeleted={(id) => {
          setGarments((list) => list?.filter((x) => x.id !== id) ?? null);
          setSelected(null);
          void load();
        }}
        onClose={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  const ready = garments?.filter((g) => g.status === "ready").length ?? 0;
  return (
    <section>
      <h1>{`Armario (${ready} ${ready === 1 ? "prenda" : "prendas"})`}</h1>
      <UploadPanel queue={queue} onProgress={onProgress} />
      {error && <p className="error-text">{error}</p>}
      {garments === null && !error && <p className="muted">Cargando…</p>}
      {garments?.length === 0 && (
        <p className="muted">Aún no hay prendas. Haz una foto por prenda, colgada o extendida y con buena luz, y súbelas por tandas.</p>
      )}
      {garments && garments.length > 0 && <GarmentGrid garments={garments} onSelect={setSelected} />}
    </section>
  );
}
