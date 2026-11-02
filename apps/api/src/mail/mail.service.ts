import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from '../jobs/queue.service.js';
import type { EmailContent } from './templates.js';

export interface MailJob extends EmailContent {
  to: string;
  workspaceId?: string | null;
}

/**
 * Emails are queued (never sent inside a request) and delivered by the worker. Transports: log (local
 * development), smtp (self-hosters), and in DEMO_MODE every email is stored for the demo mail viewer and
 * never sent.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter?: Transporter;
  /** Test runs: every queued email, newest last. */
  static readonly outbox: MailJob[] = [];

  constructor(
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  async send(job: MailJob) {
    if (config().NODE_ENV === 'test') {
      MailService.outbox.push(job);
      return;
    }
    await this.queue.add('mail', 'send', job);
  }

  /** Runs in the worker. */
  async deliver(job: MailJob) {
    const cfg = config();
    if (cfg.DEMO_MODE) {
      await this.prisma.outboundEmail.create({
        data: { workspaceId: job.workspaceId ?? null, to: job.to, subject: job.subject, text: job.text, html: job.html },
      });
      return;
    }
    if (cfg.MAIL_TRANSPORT === 'log') {
      // Local development only: the whole email in the log so codes and links can be followed.
      // In production the log transport records that an email was dropped, never its content.
      if (cfg.NODE_ENV === 'production') this.logger.warn('MAIL_TRANSPORT=log: an email was not sent');
      else this.logger.log(`\n--- email to ${job.to}: ${job.subject}\n${job.text}\n---`);
      return;
    }
    this.transporter ??= nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_SECURE,
      requireTLS: !cfg.SMTP_SECURE,
      auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS } : undefined,
    });
    await this.transporter.sendMail({ from: cfg.MAIL_FROM, to: job.to, subject: job.subject, text: job.text, html: job.html });
  }
}
