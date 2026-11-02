'use client';

import type { JobInfo } from '@openlet/shared';
import { api, apiUrl } from './api';

/** Waits for a queued file (PDF, CSV, export) and then starts the download. */
export async function waitAndDownload(job: JobInfo, base = '/jobs', timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let current = job;
  while (current.status === 'PENDING') {
    if (Date.now() - start > timeoutMs) throw new Error('This is taking longer than usual. Try again in a minute.');
    await new Promise((r) => setTimeout(r, 1000));
    current = await api<JobInfo>(`${base}/${job.id}`);
  }
  if (current.status === 'FAILED') throw new Error(current.error ?? 'The file couldn’t be made.');
  const a = document.createElement('a');
  a.href = apiUrl(`${base}/${job.id}/download`);
  a.download = current.fileName ?? '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
