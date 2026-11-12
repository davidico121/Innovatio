import sharp from "sharp";

/**
 * Re-encodes an uploaded screenshot so every stored proof is small and clean.
 * Decoding it also proves the file really is an image, whatever its declared type,
 * and re-encoding drops EXIF data such as phone location.
 */
export async function compressProof(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}
