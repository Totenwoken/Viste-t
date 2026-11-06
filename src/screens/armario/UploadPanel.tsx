import { useEffect, useReducer } from "react";
import type { UploadQueue } from "../../lib/uploadQueue";

export function UploadPanel({ queue, onProgress }: { queue: UploadQueue; onProgress?(): void }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const unsubscribe = queue.subscribe(() => {
      rerender();
      onProgress?.();
    });
    void queue.resume(); // retoma lo que quedó a medias al cerrar la app
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const items = queue.items();
  const state = queue.state();
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error");
  const active = items.filter((i) => i.status !== "error");
  const pending = active.length - done;

  return (
    <div className="upload-panel">
      <label className="btn primary upload-btn">
        Añadir prendas
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void queue.add(files);
          }}
        />
      </label>

      {state === "running" && pending > 0 && <p className="progress">{`Procesando ${done + 1} de ${active.length}`}</p>}
      {state === "idle" && done > 0 && pending === 0 && (
        <p className="muted">
          {`${done} ${done === 1 ? "prenda añadida" : "prendas añadidas"}. `}
          <button type="button" className="link" onClick={() => void queue.clearDone()}>Ocultar</button>
        </p>
      )}
      {state === "paused_budget" && (
        <p className="error-text">
          Has llegado al tope de gasto del mes. Las fotos pendientes se procesarán el mes que viene o si subes el tope.
        </p>
      )}
      {state === "paused_auth" && <p className="error-text">Vuelve a introducir el código de acceso para continuar.</p>}

      {errors.length > 0 && (
        <ul className="upload-errors">
          {errors.map((i) => (
            <li key={i.id}>
              <span>{i.error}</span>
              <button type="button" className="btn" onClick={() => void queue.retry(i.id)}>Reintentar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
