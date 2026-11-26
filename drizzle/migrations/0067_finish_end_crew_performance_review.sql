DROP POLICY IF EXISTS "Ended crew message reactions are closed" ON public.message_reactions;
DROP FUNCTION IF EXISTS public.qa_end_crew_benchmark(text);
DROP FUNCTION IF EXISTS public.qa_end_crew_benchmark(text,uuid[]);