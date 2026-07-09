/* VETA admin · utilidades de imagen (compresión y recorte en el navegador).
   Constantes de límites y helpers de canvas usados por el gestor de imágenes
   del formulario de producto. */

export const MIN_IMAGES = 3;
export const MAX_IMAGES = 10;
export const CROP_AR = 4 / 5; // ancho / alto del marco de recorte (igual que el PDP)
export const CROP_OUT_W = 1200;
export const CROP_OUT_H = 1500;

// slug a partir de un texto (para ids de categoría).
export function slugify(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// canvas.toBlob como promesa, con respaldo a JPEG si el navegador no codifica WebP.
export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) return resolve(b);
        if (type === "image/webp")
          canvas.toBlob(
            (b2) => (b2 ? resolve(b2) : reject(new Error("No se pudo procesar la imagen."))),
            "image/jpeg",
            quality
          );
        else reject(new Error("No se pudo procesar la imagen."));
      },
      type,
      quality
    );
  });
}

// Comprime/redimensiona manteniendo proporción (borde máx. `maxEdge`). Devuelve un Blob.
export async function compressImage(
  fileOrBlob,
  { maxEdge = 1600, type = "image/webp", quality = 0.85 } = {}
) {
  const bitmap = await createImageBitmap(fileOrBlob);
  let w = bitmap.width,
    h = bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();
  return canvasToBlob(canvas, type, quality);
}

// Carga una imagen lista para canvas (CORS-clean para drawImage en Storage público).
export function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}
