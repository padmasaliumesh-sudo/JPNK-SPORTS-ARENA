create extension if not exists pgcrypto;
create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 name text not null, phone text not null, slots text[] not null,
 amount integer not null check(amount>0),
 status text not null check(status in ('pending_payment','confirmed','expired','cancelled')) default 'pending_payment',
 razorpay_qr_id text unique, qr_image_url text, qr_short_url text,
 access_token text, razorpay_payment_id text unique, bank_rrn text,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes', paid_at timestamptz
);
alter table public.bookings add column if not exists access_token text;
create table if not exists public.booked_slots (
 slot_key text primary key, booking_code text not null references public.bookings(code) on delete cascade,
 expires_at timestamptz, confirmed boolean not null default false
);
create or replace function public.jpnk_create_booking_hold(p_code text,p_name text,p_phone text,p_slots text[],p_amount integer)
returns json language plpgsql security definer set search_path=public as $$
declare s text;
begin
 if cardinality(p_slots)<1 or cardinality(p_slots)>336 then raise exception 'Select between 1 and 336 slots'; end if;
 delete from booked_slots where confirmed=false and expires_at<now();
 insert into bookings(code,name,phone,slots,amount) values(p_code,p_name,p_phone,p_slots,p_amount);
 foreach s in array p_slots loop insert into booked_slots(slot_key,booking_code,expires_at) values(s,p_code,now()+interval '10 minutes'); end loop;
 return json_build_object('code',p_code);
exception when unique_violation then raise exception 'One or more selected slots are no longer available';
end; $$;
create or replace function public.jpnk_confirm_paid_booking(p_code text,p_payment_id text,p_rrn text)
returns void language plpgsql security definer set search_path=public as $$
declare b bookings%rowtype;
begin
 select * into b from bookings where code=p_code for update;
 if not found then raise exception 'Booking not found'; end if;
 if b.status='confirmed' then return; end if;
 if b.expires_at<now() then raise exception 'Booking hold expired; manual reconciliation required'; end if;
 update bookings set status='confirmed',razorpay_payment_id=p_payment_id,bank_rrn=p_rrn,paid_at=now() where code=p_code;
 update booked_slots set confirmed=true,expires_at=null where booking_code=p_code;
end; $$;
create or replace function public.jpnk_cancel_unpaid_booking(p_code text)
returns void language plpgsql security definer set search_path=public as $$
begin delete from booked_slots where booking_code=p_code and confirmed=false; update bookings set status='expired' where code=p_code and status='pending_payment'; end; $$;
create or replace function public.jpnk_admin_cancel_booking(p_code text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from bookings where code=p_code and status='confirmed' for update) then raise exception 'Confirmed booking not found'; end if;
 delete from booked_slots where booking_code=p_code;
 update bookings set status='cancelled' where code=p_code;
end; $$;
alter table public.bookings enable row level security; alter table public.booked_slots enable row level security;
revoke all on public.bookings,public.booked_slots from anon,authenticated;
revoke execute on function public.jpnk_create_booking_hold(text,text,text,text[],integer) from public,anon,authenticated;
revoke execute on function public.jpnk_confirm_paid_booking(text,text,text) from public,anon,authenticated;
revoke execute on function public.jpnk_cancel_unpaid_booking(text) from public,anon,authenticated;
revoke execute on function public.jpnk_admin_cancel_booking(text) from public,anon,authenticated;
grant execute on function public.jpnk_create_booking_hold(text,text,text,text[],integer) to service_role;
grant execute on function public.jpnk_confirm_paid_booking(text,text,text) to service_role;
grant execute on function public.jpnk_cancel_unpaid_booking(text) to service_role;
grant execute on function public.jpnk_admin_cancel_booking(text) to service_role;
