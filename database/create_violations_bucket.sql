-- Create the storage bucket for violations
insert into storage.buckets (id, name, public)
values ('violations', 'violations', true)
on conflict (id) do nothing;

-- Set up RLS policies for the violations bucket
drop policy if exists "Public Access Violations" on storage.objects;
drop policy if exists "Worker Upload Violations" on storage.objects;
drop policy if exists "Worker Delete Violations" on storage.objects;

create policy "Public Access Violations"
  on storage.objects for select
  using ( bucket_id = 'violations' );

create policy "Worker Upload Violations"
  on storage.objects for insert
  with check ( bucket_id = 'violations' );

create policy "Worker Delete Violations"
  on storage.objects for delete
  using ( bucket_id = 'violations' );
