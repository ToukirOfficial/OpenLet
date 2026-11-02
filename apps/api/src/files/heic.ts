import convert from 'heic-convert';
import { stripImage } from './storage.service.js';

/** HEIC (iPhone photos) to a clean JPEG with no metadata. Runs on the queue: it's slow. */
export async function heicToJpeg(input: Buffer): Promise<Buffer> {
  const jpeg = await convert({ buffer: new Uint8Array(input), format: 'JPEG', quality: 0.9 });
  return stripImage(Buffer.from(jpeg), 'jpeg');
}
