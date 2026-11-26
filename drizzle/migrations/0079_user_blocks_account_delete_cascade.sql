ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

COMMENT ON CONSTRAINT user_blocks_blocker_id_fkey ON public.user_blocks IS 'Account deletion removes outgoing blocks. NOT VALID preserves legacy orphan rows without blocking deployment; new writes and deletes enforce the relationship.';
COMMENT ON CONSTRAINT user_blocks_blocked_id_fkey ON public.user_blocks IS 'Account deletion removes incoming blocks, like follows. Safety reports intentionally remain independent of auth users.';