import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNav } from "./BottomNav";

test("muestra las 4 pestañas en orden y marca la activa", () => {
  render(<BottomNav active="inicio" onChange={() => {}} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels.map((l) => l?.replace(/\W/g, ""))).toEqual(["Armario", "Inicio", "Tienda", "Estilo"]);
  expect(screen.getByRole("button", { name: /Inicio/ })).toHaveAttribute("aria-current", "page");
});

test("llama a onChange con la pestaña pulsada", async () => {
  const onChange = vi.fn();
  render(<BottomNav active="inicio" onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: /Armario/ }));
  expect(onChange).toHaveBeenCalledWith("armario");
});
