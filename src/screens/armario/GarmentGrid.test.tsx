import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GarmentGrid } from "./GarmentGrid";
import { garment } from "./testData";

const list = [
  garment({ id: "a", type: "camisa", description: "camisa blanca" }),
  garment({ id: "b", type: "pantalon_chino", description: "chino beige" }),
  garment({ id: "c", type: "calzado", description: "zapatillas marrones", availability: "lavanderia" }),
  garment({ id: "d", status: "error", type: null, description: null, error: "No parece una prenda" }),
  garment({ id: "e", status: "pending", type: null, description: null }),
];

test("GarmentGrid agrupa por capa y marca 'Revisar' las de error", () => {
  render(<GarmentGrid garments={list} onSelect={() => {}} />);
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual(["Revisar", "Procesando", "Arriba", "Abajo", "Calzado"]);
  const revisar = screen.getByRole("region", { name: "Revisar" });
  expect(within(revisar).getByText("No parece una prenda")).toBeInTheDocument();
});

test("el filtro de disponibilidad oculta las demás", async () => {
  render(<GarmentGrid garments={list} onSelect={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "En la lavandería" }));
  expect(screen.getByText("zapatillas marrones")).toBeInTheDocument();
  expect(screen.queryByText("camisa blanca")).toBeNull();
});

test("las no disponibles salen atenuadas", () => {
  render(<GarmentGrid garments={list} onSelect={() => {}} />);
  expect(screen.getByRole("button", { name: /zapatillas marrones/ })).toHaveClass("unavailable");
});

test("tocar una prenda llama a onSelect", async () => {
  const onSelect = vi.fn();
  render(<GarmentGrid garments={list} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: /chino beige/ }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
});
