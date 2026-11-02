'use client';

import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, londonDate, statementSchema, type JobInfo } from '@openlet/shared';
import { Field } from '@/components/field';
import { FormDialog } from '@/components/form-dialog';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { waitAndDownload } from '@/lib/jobs';

/** Rent statement or receipt PDF for any date range. `path` is the staff or portal endpoint. */
export function StatementButton({ path, jobsBase, size, className }: { path: string; jobsBase: string; size?: 'sm' | 'default' | 'lg'; className?: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from: addDays(londonDate(), -365), to: londonDate() });
  const [working, setWorking] = useState(false);
  const form = useForm(statementSchema);
  return (
    <FormDialog title="Download a rent statement" description="A PDF of charges and payments for the dates you choose, with the balance." open={open} onOpenChange={setOpen} trigger={<Button variant="outline" size={size} className={className}><FileDown className="size-4" /> Statement</Button>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const job = await form.submit<JobInfo>(range, path);
          if (!job) return;
          setWorking(true);
          try {
            await waitAndDownload(job, jobsBase);
            setOpen(false);
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setWorking(false);
          }
        }}
      >
        <FormError message={form.formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" error={form.errors['from']}>
            {(p) => <Input {...p} type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />}
          </Field>
          <Field label="To" error={form.errors['to']}>
            {(p) => <Input {...p} type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />}
          </Field>
        </div>
        <Button type="submit" disabled={form.pending || working}>
          {working ? 'Making your PDF…' : 'Download PDF'}
        </Button>
      </form>
    </FormDialog>
  );
}
