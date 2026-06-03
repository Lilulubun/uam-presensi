-- 0008_test_tpa.sql — test TPA "uii" for development/testing purposes
-- Will be removed later. Not a real attendance location.
insert into public.tpas (id, name, location, static_qr_code) values
  ('tpa-uii-test', 'uii', '{"lat":-7.687445025761007,"lng":110.41569060716313,"radius":5000}', 'UII-TEST')
on conflict (id) do nothing;
