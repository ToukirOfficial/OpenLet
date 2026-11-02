import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { config } from '../config.js';

export type StoredMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | 'text/csv' | 'application/zip';
export interface Stored {
  key: string;
  mime: StoredMime;
  size: number;
  /** HEIC photos are saved as they came and converted to JPEG on the queue. */
  needsConversion: boolean;
}

const KEY = /^(files|exports)\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/;
const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];

/**
 * Private files on local disk under STORAGE_DIR, outside any public folder. Names are random UUIDs; the
 * uploaded file name is never used. Types are checked from the content, not the name. Photos are
 * re-encoded, which drops all metadata (EXIF, GPS). Files are only ever served by API routes that have
 * checked permissions first.
 */
@Injectable()
export class StorageService {
  root() {
    return path.resolve(config().STORAGE_DIR);
  }

  private resolve(key: string) {
    if (!KEY.test(key)) throw new NotFoundException();
    return path.join(this.root(), key);
  }

  private newKey(folder: 'files' | 'exports') {
    const now = new Date();
    return `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
  }

  /** Validates and stores an uploaded file. `imagesOnly` for photos and logos. */
  async saveUpload(file: Express.Multer.File | undefined, opts: { imagesOnly?: boolean } = {}): Promise<Stored> {
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'NO_FILE', message: 'Choose a file to upload.' });
    if (file.size > config().UPLOAD_MAX_BYTES) {
      throw new BadRequestException({ code: 'TOO_LARGE', message: `That file is too large. The limit is ${Math.round(config().UPLOAD_MAX_BYTES / 1024 / 1024)} MB.` });
    }
    const detected = await fileTypeFromBuffer(file.buffer);
    const mime = detected?.mime ?? '';
    const allowed = opts.imagesOnly ? UPLOAD_TYPES.filter((m) => m.startsWith('image/')) : UPLOAD_TYPES;
    if (!allowed.includes(mime)) {
      throw new BadRequestException({ code: 'BAD_TYPE', message: opts.imagesOnly ? 'Upload a photo (JPEG, PNG or HEIC).' : 'Upload a PDF, JPEG, PNG or HEIC file.' });
    }
    if (mime === 'image/heic' || mime === 'image/heif') {
      return { ...(await this.write(file.buffer, 'files')), mime: 'image/heic', needsConversion: true };
    }
    if (mime === 'application/pdf') return { ...(await this.write(file.buffer, 'files')), mime: 'application/pdf', needsConversion: false };
    const clean = await stripImage(file.buffer, mime === 'image/png' ? 'png' : 'jpeg');
    return { ...(await this.write(clean, 'files')), mime: mime as 'image/jpeg' | 'image/png', needsConversion: false };
  }

  async write(buffer: Buffer, folder: 'files' | 'exports') {
    const key = this.newKey(folder);
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
    await writeFile(full, buffer, { mode: 0o600 });
    return { key, size: buffer.length };
  }

  async replace(key: string, buffer: Buffer) {
    await writeFile(this.resolve(key), buffer, { mode: 0o600 });
    return buffer.length;
  }

  read(key: string) {
    return readFile(this.resolve(key));
  }

  async stream(key: string) {
    const full = this.resolve(key);
    await stat(full).catch(() => {
      throw new NotFoundException({ message: 'File not found.' });
    });
    return createReadStream(full);
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/** Re-encodes an image: applies the camera rotation, then drops every bit of metadata (EXIF, GPS). */
export async function stripImage(buffer: Buffer, format: 'jpeg' | 'png'): Promise<Buffer> {
  const img = sharp(buffer, { failOn: 'error' }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true });
  return format === 'png' ? img.png().toBuffer() : img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
