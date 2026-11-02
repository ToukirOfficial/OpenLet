import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { config } from './config.js';
import { CommonModule } from './common/common.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RetentionModule } from './retention/retention.module.js';
import { JobProcessors } from './jobs/processors.js';
import { QUEUES, QueueService } from './jobs/queue.service.js';
import { RedisService } from './redis.service.js';

/** Scheduled jobs, in London time (plan.md deploy notes). */
const SCHEDULES: { id: string; pattern: string; demoOnly?: boolean }[] = [
  { id: 'rent-charges', pattern: '0 2 * * *' },
  { id: 'purge-exports', pattern: '15 * * * *' },
  { id: 'reminders', pattern: '0 8 * * *' },
  { id: 'retention', pattern: '30 3 * * *' },
];

@Module({ imports: [CommonModule, DocumentsModule, LedgerModule, ExportsModule, ComplianceModule, RemindersModule, ReportsModule, RetentionModule, JobsModule] })
class WorkerModule {}

const logger = new Logger('Worker');
const cfg = config();
const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'warn', 'error'] });
app.enableShutdownHooks();
const processors = app.get(JobProcessors);
const redis = app.get(RedisService);
const queues = app.get(QueueService);

const workers = Object.values(QUEUES).map(
  (name) =>
    new Worker(name, (job) => processors.run(name, job), {
      connection: redis.connection(),
      prefix: `${cfg.REDIS_PREFIX}:bull`,
      concurrency: name === 'mail' ? 4 : 2,
    }),
);
for (const w of workers) w.on('failed', (job, err) => logger.error(`${w.name}:${job?.name} failed: ${err.message}`));

const schedule = queues.queue('schedule');
for (const s of SCHEDULES) {
  if (s.demoOnly && !cfg.DEMO_MODE) {
    await schedule.removeJobScheduler(s.id);
    continue;
  }
  await schedule.upsertJobScheduler(s.id, { pattern: s.pattern, tz: 'Europe/London' }, { name: s.id });
}
logger.log(`OpenLet worker running (${workers.length} queues, ${SCHEDULES.length} schedules)`);

const stop = async () => {
  await Promise.all(workers.map((w) => w.close()));
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
