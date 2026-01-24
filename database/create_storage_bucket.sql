-- Create the storage bucket
insert into storage.buckets (id, name, public)
values ('junction-frames', 'junction-frames', true)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket
-- Drop existing policies first to avoid "already exists" errors
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Worker Upload" on storage.objects;
drop policy if exists "Worker Delete" on storage.objects;
drop policy if exists "Worker Update" on storage.objects;

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'junction-frames' );

create policy "Worker Upload"
  on storage.objects for insert
  with check ( bucket_id = 'junction-frames' );

create policy "Worker Delete"
  on storage.objects for delete
  using ( bucket_id = 'junction-frames' );

create policy "Worker Update"
  on storage.objects for update
  using ( bucket_id = 'junction-frames' );
