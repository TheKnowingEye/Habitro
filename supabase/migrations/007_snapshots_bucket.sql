-- ============================================================
-- 007_snapshots_bucket.sql
--
-- Creates the `snapshots` storage bucket for check-in photos
-- and sets up RLS policies so users can upload to their own
-- folder and anyone in the same duel can read.
-- ============================================================

-- Create the public bucket (public = URLs are readable without auth,
-- which is what we want so Evidence Feed can render <img src="...">)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snapshots',
  'snapshots',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Users can upload only into their own user-id folder:
--   {user_id}/{duel_id}/{date}-{habit_id_prefix}.{ext}
create policy "Users can upload their own snapshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'snapshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite (upsert) their own snapshots
create policy "Users can update their own snapshots"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'snapshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket — anyone can read (needed for Evidence Feed img src)
create policy "Public read access for snapshots"
  on storage.objects for select
  to public
  using (bucket_id = 'snapshots');
