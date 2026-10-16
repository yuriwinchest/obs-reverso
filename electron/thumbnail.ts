export const maxThumbnailBytes = 2 * 1024 * 1024;
export type ThumbnailMime = "image/jpeg" | "image/png";
export type Thumbnail = { name: string; bytes: Buffer; mime: ThumbnailMime };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The extension filter in the dialog is cosmetic; only the leading bytes decide the type.
export function thumbnailMime(bytes: Buffer): ThumbnailMime {
  if (bytes.length > maxThumbnailBytes)
    throw new Error("A capa precisa ter até 2 MB.");
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (bytes.length > png.length && bytes.subarray(0, png.length).equals(png))
    return "image/png";
  throw new Error("A capa precisa ser uma imagem JPG ou PNG.");
}
export function thumbnailName(file: string) {
  const name = file.split(/[\\/]/).pop() ?? "";
  return name.length > 80 ? `${name.slice(0, 77)}…` : name;
}
export class ThumbnailRefused extends Error {}
export function thumbnailRefusal(status: number) {
  if (status === 403)
    return "O YouTube não permitiu a capa neste canal. Miniaturas personalizadas exigem canal verificado (youtube.com/verify). A live continua; defina a capa no YouTube Studio.";
  if (status === 429)
    return "O YouTube limitou o envio de capas por agora. A live continua; tente a capa mais tarde no YouTube Studio.";
  if (status === 400)
    return "O YouTube recusou a imagem da capa. A live continua; tente outra imagem no YouTube Studio.";
  return `Não foi possível aplicar a capa (${status}). A live continua; defina a capa no YouTube Studio.`;
}
export async function applyThumbnail(
  youtube: {
    setThumbnail(
      videoId: string,
      bytes: Buffer,
      mime: ThumbnailMime,
    ): Promise<void>;
  },
  videoId: string,
  thumbnail: Thumbnail,
  report: (ok: boolean, message: string) => void,
  current: () => boolean,
) {
  try {
    await youtube.setThumbnail(videoId, thumbnail.bytes, thumbnail.mime);
    if (current()) report(true, "Capa aplicada na transmissão do YouTube.");
  } catch (error) {
    if (current())
      report(
        false,
        error instanceof ThumbnailRefused
          ? error.message
          : "Não foi possível enviar a capa. A live continua; defina a capa no YouTube Studio.",
      );
  }
}
