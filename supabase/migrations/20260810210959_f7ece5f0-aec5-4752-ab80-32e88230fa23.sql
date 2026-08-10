CREATE POLICY "Users read own document files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own document files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own document files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own document files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);