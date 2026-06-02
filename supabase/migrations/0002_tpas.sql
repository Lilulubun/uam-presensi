-- 0002_tpas.sql — 11 TPAs from src/lib/mock-data.ts (real coordinates)
insert into public.tpas (id, name, location, static_qr_code) values
  ('tpa-001', 'TPA Al-Fath',                  '{"lat":-7.6864394412020145,"lng":110.4183135208608,"radius":100}', 'TPA-001'),
  ('tpa-002', 'TPA Adz-Dzikro',               '{"lat":-7.744803275758542,"lng":110.41414103514991,"radius":100}',  'TPA-002'),
  ('tpa-003', 'TPA Al-Hidayah Besirejo',      '{"lat":-7.69690001497496,"lng":110.41985753233598,"radius":100}',    'TPA-003'),
  ('tpa-004', 'TPA Al-Hidayah Tanjungsari',   '{"lat":-7.692058086494675,"lng":110.44915826476229,"radius":100}',   'TPA-004'),
  ('tpa-005', 'TPA Al-Iman',                  '{"lat":-7.697983633584647,"lng":110.40599807240116,"radius":100}',   'TPA-005'),
  ('tpa-006', 'TPA Ananda',                   '{"lat":-7.699886036726615,"lng":110.40676711984223,"radius":100}',   'TPA-006'),
  ('tpa-007', 'TPA Az-Zahra',                 '{"lat":-7.672930214991263,"lng":110.40046648044921,"radius":100}',   'TPA-007'),
  ('tpa-008', 'TPA Al-Muhtadin',              '{"lat":-7.7012103705816655,"lng":110.4062802454369,"radius":100}',  'TPA-008'),
  ('tpa-009', 'TPA Al-Jami''',                 '{"lat":-7.687739641892811,"lng":110.40873308217957,"radius":100}',   'TPA-009'),
  ('tpa-010', 'TPA Ulil Albab',               '{"lat":-7.701725012893864,"lng":110.41550971507898,"radius":100}',   'TPA-010'),
  ('tpa-011', 'TPA Sholihin',                 '{"lat":-7.695346961575441,"lng":110.41336418264429,"radius":100}',   'TPA-011')
on conflict (id) do nothing;
