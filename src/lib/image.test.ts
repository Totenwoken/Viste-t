import { compressImage, fitWithin, ImageDecodeError, uploadToSignedUrl } from "./image";

vi.mock("@imgly/background-removal", () => ({ removeBackground: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

test("fitWithin reduce 4032×3024 a 1024×768 y no amplía 800×600", () => {
  expect(fitWithin(4032, 3024)).toEqual({ w: 1024, h: 768 });
  expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
});

test("fitWithin respeta fotos en vertical", () => {
  expect(fitWithin(3024, 4032)).toEqual({ w: 768, h: 1024 });
});

test("compressImage lanza ImageDecodeError si createImageBitmap falla", async () => {
  vi.stubGlobal("createImageBitmap", () => Promise.reject(new Error("bad")));
  await expect(compressImage(new Blob(["x"]))).rejects.toBeInstanceOf(ImageDecodeError);
});

test("uploadToSignedUrl hace PUT con el tipo de la imagen", async () => {
  const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await uploadToSignedUrl("https://up", new Blob(["x"], { type: "image/png" }));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://up");
  expect(init?.method).toBe("PUT");
  expect(new Headers(init?.headers).get("content-type")).toBe("image/png");
});

test("uploadToSignedUrl lanza si la subida falla", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  await expect(uploadToSignedUrl("https://up", new Blob(["x"], { type: "image/webp" }))).rejects.toThrow();
});
