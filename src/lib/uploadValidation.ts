export const MAX_UPLOAD_FILE_COUNT = 20;
export const MAX_UPLOAD_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB (Vercel limit is 4.5MB)

export const SUPPORTED_UPLOAD_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
] as const;

export const SUPPORTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const MIME_TYPE_ALIASES: Record<
  string,
  (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number]
> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

export const UPLOAD_ACCEPT_ATTRIBUTE = [
  ...SUPPORTED_UPLOAD_MIME_TYPES,
  ...SUPPORTED_UPLOAD_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

type UploadFileLike = {
  name: string;
  size?: number;
  type?: string | null;
};

export function getUploadFileExtension(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() || "";
}

export function normalizeUploadMimeType(mimeType: string | null | undefined) {
  const normalized = String(mimeType || "")
    .trim()
    .toLowerCase();
  return MIME_TYPE_ALIASES[normalized] || normalized;
}

export function isSupportedUploadFile(file: UploadFileLike) {
  const extension = getUploadFileExtension(file.name);
  const mimeType = normalizeUploadMimeType(file.type);
  const isAllowedType = mimeType
    ? SUPPORTED_UPLOAD_MIME_TYPES.includes(
        mimeType as (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number],
      )
    : false;
  const isAllowedExtension = SUPPORTED_UPLOAD_EXTENSIONS.includes(
    extension as (typeof SUPPORTED_UPLOAD_EXTENSIONS)[number],
  );

  return isAllowedType || isAllowedExtension;
}

export function getUploadFileTypeError(file: UploadFileLike) {
  if (isSupportedUploadFile(file)) return null;
  return "Solo se permiten imagenes JPG, PNG, WebP o AVIF.";
}

export function getUploadFileSizeError(file: UploadFileLike) {
  if (typeof file.size !== "number") return null;
  if (file.size <= MAX_UPLOAD_FILE_SIZE_BYTES) return null;
  return `Error: ${file.name} es demasiado grande (máximo 4MB).`;
}
