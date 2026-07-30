-- 1. Insert dummy presensi untuk Adz-Dzikro (tpa-002)
-- Skenario: 20 hari sesi.
-- Agar status 'AMAN' (wajib 8 sesi), kita masukkan 10 hari hadir.
INSERT INTO public.attendances (session_id, user_id, scan_in_time, is_late)
SELECT 
    s.id, 
    pt.user_id, 
    s.date_opened + (i * interval '1 day'), 
    random() < 0.2
FROM public.sessions s
JOIN public.pengajar_tpa pt ON s.tpa_id = pt.tpa_id
CROSS JOIN generate_series(0, 9) i
WHERE s.tpa_id = 'tpa-002'
ON CONFLICT DO NOTHING;

-- 2. Insert dummy presensi untuk AS-SHOLIHIN (tpa-011)
-- Skenario: 20 hari sesi.
-- Agar status 'TIDAK AMAN', kita masukkan 5 hari hadir.
INSERT INTO public.attendances (session_id, user_id, scan_in_time, is_late)
SELECT 
    s.id, 
    pt.user_id, 
    s.date_opened + (i * interval '1 day'), 
    false
FROM public.sessions s
JOIN public.pengajar_tpa pt ON s.tpa_id = pt.tpa_id
CROSS JOIN generate_series(0, 4) i
WHERE s.tpa_id = 'tpa-011'
ON CONFLICT DO NOTHING;
