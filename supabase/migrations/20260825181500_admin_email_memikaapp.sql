-- L'email admin seed `maurizio.cocco@memika.app` (security_hardening.sql:35)
-- è una casella inesistente: il dominio memika.app non è mai stato
-- registrato (verificato 2026-08-25). Con la conferma email disattivata,
-- chiunque si fosse registrato con quell'indirizzo sarebbe diventato admin.
-- L'account admin del titolare è la casella reale memikaapp@gmail.com.

insert into public.admin_emails (email, granted_by)
values ('memikaapp@gmail.com', 'angelo 2026-08-25 (real mailbox, replaces memika.app seed)')
on conflict (email) do nothing;

delete from public.admin_emails where lower(email) = 'maurizio.cocco@memika.app';

-- Nessun profilo esistente da riallineare: auth.users era vuota al 2026-08-25.
