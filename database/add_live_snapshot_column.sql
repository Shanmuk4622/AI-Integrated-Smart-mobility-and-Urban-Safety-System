-- Add live_snapshot_url column to junctions table
alter table junctions 
add column if not exists live_snapshot_url text;

-- Allow worker to update this column
create policy "Worker Update Snapshots"
  on junctions for update
  using (true)
  with check (true);
