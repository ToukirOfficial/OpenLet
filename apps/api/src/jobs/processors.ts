import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MailService, type MailJob } from '../mail/mail.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

/**
 * Runs every queued job by name. The worker process calls this; tests call it directly with the jobs
 * collected in QueueService.testJobs.
 */
@Injectable()
export class JobProcessors {
  private readonly logger = new Logger('Jobs');

  constructor(
    private readonly mail: MailService,
    private readonly documents: DocumentsService,
    private readonly ledger: LedgerService,
  ) {}

  async run(queue: string, job: Pick<Job, 'name' | 'data'>): Promise<unknown> {
    switch (`${queue}:${job.name}`) {
      case 'mail:send':
        return this.mail.deliver(job.data as MailJob);
      case 'work:convert-heic':
        return this.documents.convertHeic((job.data as { documentId: string }).documentId);
      case 'work:charges':
        return this.ledger.generateFor((job.data as { tenancyId: string }).tenancyId);
      case 'schedule:rent-charges':
        return this.ledger.generateAll();
      default:
        this.logger.warn(`No processor for ${queue}:${job.name}`);
        return undefined;
    }
  }
}
