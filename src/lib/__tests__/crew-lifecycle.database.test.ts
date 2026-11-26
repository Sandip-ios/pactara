import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Read-only checks against the draft database. Browser deletion and classic
// action results, and authenticated EXPLAIN plans, are recorded in qa review.
const scalar = (query: string) => execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim();

describe.skipIf(!process.env['PGHOST'])('End crew database regression rules', () => {
  it('membership guard runs on INSERT and UPDATE, never DELETE', () => {
    expect(scalar("SELECT tgtype FROM pg_trigger WHERE tgname='active_crew_members' AND tgrelid='public.group_members'::regclass")).toBe('23');
    expect(scalar("SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid='public.guard_active_crew_write()'::regprocedure AND (tgtype & 8)=8")).toBe('0');
  });
  it('has no extra End crew restrictive storage read policy', () => {
    expect(scalar("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND policyname='Ended crew media keeps owner access'")).toBe('0');
  });
  it('retains only the measured fast End crew read restrictions', () => {
    expect(scalar("SELECT string_agg(tablename,',' ORDER BY tablename) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Ended crew %' AND cmd='SELECT'")).toBe('check_ins,daily_posts');
  });
  it('keeps unrelated blocked-user restrictive policies on all eight tables', () => {
    expect(scalar("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Bilateral %' AND tablename IN ('check_ins','daily_posts','group_messages','post_comments','post_reactions','message_reactions','comment_likes','workout_cheers')")).toBe('8');
  });
  it('historical reports and requests cannot prevent deleting the referenced crew', () => {
    expect(scalar("SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.groups'::regclass AND conrelid IN ('public.content_reports'::regclass,'public.crew_join_requests'::regclass)")).toBe('0');
    expect(scalar("SELECT count(*) FROM pg_trigger WHERE tgname IN ('validate_report_crew_reference','validate_join_request_crew_reference') AND tgtype=23")).toBe('2');
  });
  it('ships no temporary performance endpoints', () => {
    expect(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='qa_end_crew_benchmark'")).toBe('0');
  });
});

describe.skipIf(!process.env['PGHOST'])('Crew discovery needs a new-version owner', () => {
  it('request_crew_join refuses crews whose owner is not on the new version', () => {
    expect(scalar("SELECT position('is_new_version_user(g.owner_id)' in prosrc)>0 FROM pg_proc WHERE proname='request_crew_join'")).toBe('t');
  });
  it('new crews owned by classic members are saved hidden', () => {
    expect(scalar("SELECT position('is_new_version_user(NEW.owner_id)' in prosrc)>0 FROM pg_proc WHERE proname='normalize_crew_discovery'")).toBe('t');
  });
});
