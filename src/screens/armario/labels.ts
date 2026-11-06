import type { Availability, GarmentType, Layer, Season } from "../../../shared/garment";

export const TYPE_LABEL: Record<GarmentType, string> = {
  camiseta: "Camiseta",
  camisa: "Camisa",
  polo: "Polo",
  jersey: "Jersey",
  sudadera: "Sudadera",
  sobrecamisa: "Sobrecamisa",
  pantalon_vaquero: "Pantalón vaquero",
  pantalon_chino: "Pantalón chino",
  pantalon_traje: "Pantalón de traje",
  pantalon_otro: "Otro pantalón",
  bermuda: "Bermuda",
  abrigo: "Abrigo",
  cazadora: "Cazadora",
  americana: "Americana",
  chaqueta_traje: "Chaqueta de traje",
  calzado: "Calzado",
  complemento: "Complemento",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  disponible: "Disponible",
  lavanderia: "En la lavandería",
  guardada: "Guardada",
};

export const FORMALITY_LABEL: Record<number, string> = {
  1: "Deporte/casa",
  2: "Informal",
  3: "Smart casual",
  4: "Formal de oficina",
  5: "Traje/ceremonia",
};

export const SEASON_LABEL: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};

export const LAYER_LABEL: Record<Layer, string> = {
  top: "Arriba",
  mid: "Jerséis",
  bottom: "Abajo",
  outer: "Abrigo",
  shoes: "Calzado",
  accessory: "Complementos",
};

export const LAYER_ORDER: Layer[] = ["top", "mid", "bottom", "outer", "shoes", "accessory"];
