const KEY = "vistet.accessCode";

export class UnauthorizedError extends Error {
  constructor() {
    super("Código de acceso no válido");
    this.name = "UnauthorizedError";
  }
}

export class BudgetExceededError extends Error {
  constructor() {
    super("Has llegado al tope de gasto del mes");
    this.name = "BudgetExceededError";
  }
}

export function getAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAccessCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* almacenamiento bloqueado: se pedirá el código otra vez */
  }
}

export function clearAccessCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
}

/** fetch hacia nuestras funciones con el código de acceso; traduce 401 y 402 en errores tipados. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-access-code", getAccessCode() ?? "");
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearAccessCode();
    window.dispatchEvent(new Event("vistet:unauthorized"));
    throw new UnauthorizedError();
  }
  if (res.status === 402) throw new BudgetExceededError();
  return res;
}
