import { createFileRoute } from '@tanstack/react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAdmin } from '@/lib/admin/context';
import { getContentReports, reviewContentReport } from '@/lib/admin/reports.functions';
import { reportAge, reportReasons } from '@/lib/safety-rules';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyNote } from '@/components/admin/kit';
import '@/components/safety/safety.css';

export const Route = createFileRoute('/admin/reports')({
  head: () => ({ meta: [
    { title: 'Reports · Pactara Founder Dashboard' }, { name: 'description', content: 'Private safety report review for Pactara.' },
    { property: 'og:title', content: 'Reports · Pactara Founder Dashboard' }, { property: 'og:description', content: 'Private safety report review for Pactara.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' },
  ] }), component: ReportsPage,
});

function ReportsPage() {
  const { dashboardKey } = useAdmin();
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const qc = useQueryClient();
  const load = useServerFn(getContentReports);
  const review = useServerFn(reviewContentReport);
  const query = useInfiniteQuery({ queryKey: ['admin-reports', status], initialPageParam: null as string | null, queryFn: ({ pageParam }) => load({ data: { key: dashboardKey, status, before: pageParam } }), getNextPageParam: last => last.nextBefore ?? undefined });
  const action = useMutation({ mutationFn: (data: { reportId: string; action: 'remove_content' | 'remove_member' | 'dismiss' }) => review({ data: { ...data, key: dashboardKey } }), onSuccess: () => { toast.success('Report reviewed'); void qc.invalidateQueries({ queryKey: ['admin-reports'] }); void qc.invalidateQueries({ queryKey: ['admin-report-count'] }); }, onError: (error: Error) => toast.error(error.message) });
  const reports = query.data?.pages.flatMap(p => p.reports) ?? [];
  return <div className="space-y-6">
    <PageHeader title="Reports" subtitle="Member reports, newest first." />
    <div className="flex gap-2"><Button variant={status === 'open' ? 'default' : 'outline'} onClick={() => setStatus('open')}>Open</Button><Button variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')}>All reports</Button></div>
    {query.isError ? <div role="alert"><p>Could not load reports.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div> : query.isPending ? <p>Loading reports…</p> : !reports.length ? <EmptyNote>No reports.</EmptyNote> : <ul className="space-y-4">{reports.map(r => {
      const age = reportAge(r.created_at);
      return <li key={r.id} className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{r.reporter} reported {r.reportedMember}</h2><span className={age.overdue && r.status === 'open' ? 'safety-danger-text text-sm font-bold' : 'text-sm text-muted-foreground'}>{r.status === 'open' ? `${age.hours} hours open` : r.status}</span></div>
        <p className="mt-1 text-sm text-muted-foreground">{r.crewName} · {new Date(r.created_at).toLocaleString()} · {r.target_type}</p>
        <p className="mt-3 font-semibold">{reportReasons.find(([value]) => value === r.reason)?.[1] ?? r.reason}</p>
        {r.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.details}</p>}
        {r.preview && <div className="mt-4 flex items-start gap-3 border-l-2 border-border pl-3">{r.preview.image && <img src={r.preview.image} alt="Reported content" className="size-20 rounded-lg object-cover" />}<p className="whitespace-pre-wrap break-words text-sm">{r.preview.text || 'Photo or video'}</p></div>}
        {r.status === 'open' && <div className="mt-4 flex flex-wrap gap-2">
          {r.target_type !== 'user' && <Button variant="destructive" disabled={action.isPending} onClick={() => action.mutate({ reportId: r.id, action: 'remove_content' })}>Remove content</Button>}
          {r.group_id && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ reportId: r.id, action: 'remove_member' })}>Remove member from crew</Button>}
          <Button variant="ghost" disabled={action.isPending} onClick={() => action.mutate({ reportId: r.id, action: 'dismiss' })}>Dismiss</Button>
        </div>}
      </li>;
    })}</ul>}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load older reports</Button>}
  </div>;
}