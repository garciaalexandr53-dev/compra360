INSERT INTO public.user_roles (user_id, role)
VALUES ('9a62b056-15d0-41ec-a6f0-74a09af0ee21', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;