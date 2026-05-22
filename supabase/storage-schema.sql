-- Create storage bucket for business documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents',
  'business-documents',
  false,
  10485760, -- 10MB limit
  array['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Policy: Allow authenticated users to upload documents to their own business folder
drop policy if exists "Authenticated users can upload business documents" on storage.objects;
create policy "Authenticated users can upload business documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-documents'
  -- Ensure the path starts with a business ID that the user owns
  and exists (
    select 1 from public.businesses
    where id::text = (string_to_array(name, '/'))[1]
    and owner_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to select/read documents in their own business folder
drop policy if exists "Authenticated users can read business documents" on storage.objects;
create policy "Authenticated users can read business documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1 from public.businesses
    where id::text = (string_to_array(name, '/'))[1]
    and owner_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to delete documents in their own business folder
drop policy if exists "Authenticated users can delete business documents" on storage.objects;
create policy "Authenticated users can delete business documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1 from public.businesses
    where id::text = (string_to_array(name, '/'))[1]
    and owner_id = auth.uid()
  )
);
