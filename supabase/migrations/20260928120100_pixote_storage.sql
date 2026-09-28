-- Pixote CRM: fotos de sucatas e peças no Supabase Storage.
-- Bucket privado. Cada arquivo fica em "<auth.uid()>/<pasta>/<arquivo>" e somente o dono lê, grava ou remove.
-- Separado do schema principal porque depende do schema "storage" do Supabase.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('pixote-photos', 'pixote-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "pixote photos read own" on storage.objects for select to authenticated
 using (bucket_id = 'pixote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pixote photos insert own" on storage.objects for insert to authenticated
 with check (bucket_id = 'pixote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pixote photos delete own" on storage.objects for delete to authenticated
 using (bucket_id = 'pixote-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
