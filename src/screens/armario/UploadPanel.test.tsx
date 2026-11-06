import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPanel } from "./UploadPanel";
import type { QueueItem, QueueState, UploadQueue } from "../../lib/uploadQueue";

vi.mock("@imgly/background-removal", () => ({ removeBackground: vi.fn() }));

function fakeQueue(items: QueueItem[], state: QueueState = "idle") {
  return {
    add: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    clearDone: vi.fn(async () => {}),
    items: () => items,
    state: () => state,
    subscribe: () => () => {},
  } satisfies UploadQueue;
}

test("UploadPanel llama a resume() al montarse", () => {
  const q = fakeQueue([]);
  render(<UploadPanel queue={q} />);
  expect(q.resume).toHaveBeenCalledTimes(1);
});

test("UploadPanel muestra el aviso de tope cuando la cola está paused_budget", () => {
  render(<UploadPanel queue={fakeQueue([{ id: "1", status: "uploaded" }], "paused_budget")} />);
  expect(screen.getByText(/Has llegado al tope de gasto del mes/)).toBeInTheDocument();
});

test("muestra el progreso 'Procesando 2 de 3'", () => {
  const items: QueueItem[] = [
    { id: "1", status: "done" },
    { id: "2", status: "created" },
    { id: "3", status: "queued" },
  ];
  render(<UploadPanel queue={fakeQueue(items, "running")} />);
  expect(screen.getByText("Procesando 2 de 3")).toBeInTheDocument();
});

test("los elementos con error tienen 'Reintentar'", async () => {
  const q = fakeQueue([{ id: "x", status: "error", error: "No se puede leer esta foto" }]);
  render(<UploadPanel queue={q} />);
  expect(screen.getByText("No se puede leer esta foto")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(q.retry).toHaveBeenCalledWith("x");
});

test("elegir fotos las añade a la cola", async () => {
  const q = fakeQueue([]);
  render(<UploadPanel queue={q} />);
  const file = new File(["x"], "camisa.jpg", { type: "image/jpeg" });
  await userEvent.upload(screen.getByLabelText("Añadir prendas"), [file]);
  expect(q.add).toHaveBeenCalledWith([file]);
});
