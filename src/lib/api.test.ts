import { apiFetch, BudgetExceededError, getAccessCode, setAccessCode, UnauthorizedError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("añade la cabecera x-access-code", async () => {
  setAccessCode("abc");
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await apiFetch("/api/garments");
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect(new Headers(init.headers).get("x-access-code")).toBe("abc");
});

test("401 borra el código, emite vistet:unauthorized y lanza UnauthorizedError", async () => {
  setAccessCode("abc");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  const listener = vi.fn();
  window.addEventListener("vistet:unauthorized", listener);
  await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(UnauthorizedError);
  expect(getAccessCode()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener("vistet:unauthorized", listener);
});

test("402 lanza BudgetExceededError", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 402 })));
  await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(BudgetExceededError);
});
