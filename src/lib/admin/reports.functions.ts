import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const getOpenReportCount = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ key: z.string().min(1) }))
  .handler(async ({ data }) => {
    const expected = process.env['FOUNDER_DASHBOARD_KEY'];
    if (!expected || data.key !== expected) throw new Error('Unauthorized');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { count, error } = await supabaseAdmin.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    if (error) throw new Error('Could not load reports');
    return count ?? 0;
  });

export const getContentReports = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ key: z.string().min(1), before: z.string().datetime().nullable(), status: z.enum(['open', 'all']) }))
  .handler(async ({ data }) => {
    const expected = process.env['FOUNDER_DASHBOARD_KEY'];
    if (!expected || data.key !== expected) throw new Error('Unauthorized');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { signFeedMedia, signVideoPosters, isVideoPath } = await import('@/lib/media-urls');
    let query = supabaseAdmin.from('content_reports').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51);
    if (data.status === 'open') query = query.eq('status', 'open');
    if (data.before) query = query.lt('created_at', data.before);
    const { data: reports, error } = await query;
    if (error) throw new Error('Could not load reports');
    const page = reports?.slice(0, 50) ?? [];
    const ids = [...new Set(page.flatMap(r => [r.reporter_id, r.reported_user_id]))];
    const { data: people } = ids.length ? await supabaseAdmin.from('profiles').select('id, name').in('id', ids) : { data: [] };
    const { data: groups } = page.length ? await supabaseAdmin.from('groups').select('id, name').in('id', [...new Set(page.flatMap(r => r.group_id ? [r.group_id] : []))]) : { data: [] };
    const previews = await Promise.all(page.map(async report => {
      if (!report.target_id || report.target_type === 'user') return null;
      if (report.target_type === 'comment') {
        const { data: comment } = await supabaseAdmin.from('post_comments').select('body, media_url').eq('id', report.target_id).maybeSingle();
        return comment ? { text: comment.body, path: comment.media_url } : null;
      }
      const [{ data: checkIn }, { data: thought }, { data: post }] = await Promise.all([
        supabaseAdmin.from('check_ins').select('note, photo_url').eq('id', report.target_id).maybeSingle(),
        supabaseAdmin.from('daily_thoughts').select('text, photo_url').eq('id', report.target_id).maybeSingle(),
        supabaseAdmin.from('daily_posts').select('morning_ritual_text').eq('id', report.target_id).maybeSingle(),
      ]);
      return checkIn ? { text: checkIn.note, path: checkIn.photo_url } : thought ? { text: thought.text, path: thought.photo_url } : post ? { text: post.morning_ritual_text, path: null } : null;
    }));
    const paths = previews.flatMap(p => p?.path ? [p.path] : []);
    const [images, posters] = await Promise.all([signFeedMedia(supabaseAdmin, paths.filter(p => !isVideoPath(p))), signVideoPosters(supabaseAdmin, paths.filter(isVideoPath))]);
    return {
      reports: page.map((r, i) => {
        const preview = previews[i];
        const path = preview?.path;
        return { ...r, reporter: people?.find(p => p.id === r.reporter_id)?.name ?? 'Deleted member', reportedMember: people?.find(p => p.id === r.reported_user_id)?.name ?? 'Deleted member', crewName: r.group_id ? groups?.find(g => g.id === r.group_id)?.name ?? 'Crew' : 'No shared crew', preview: preview ? { text: preview.text, image: path ? isVideoPath(path) ? posters.get(path) ?? null : path.startsWith('http') ? path : images.get(path) ?? null : null } : null };
      }),
      nextBefore: (reports?.length ?? 0) > 50 ? page.at(-1)?.created_at ?? null : null,
    };
  });

export const reviewContentReport = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ key: z.string().min(1), reportId: z.string().uuid(), action: z.enum(['remove_content', 'remove_member', 'dismiss']) }))
  .handler(async ({ data }) => {
    const expected = process.env['FOUNDER_DASHBOARD_KEY'];
    if (!expected || data.key !== expected) throw new Error('Unauthorized');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (data.action === 'remove_member') {
      const { data: report } = await supabaseAdmin.from('content_reports').select('group_id').eq('id', data.reportId).maybeSingle();
      if (report && !report.group_id) throw new Error('This report has no shared crew.');
    }
    const { error } = await supabaseAdmin.rpc('review_content_report', { _id: data.reportId, _action: data.action });
    if (error) throw new Error('Could not review report. Please try again.');
    return { ok: true };
  });