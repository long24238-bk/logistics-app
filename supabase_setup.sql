-- =====================================================================
--  신신사 기사님 물류비 앱 — Supabase 설치 SQL
--  사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--  (근태 앱과 같은 프로젝트에 넣어도 됩니다. 모든 이름이 lg_ 로 시작해서 겹치지 않습니다)
--  여러 번 실행해도 기존 데이터는 지워지지 않습니다.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- 테이블 ----------
create table if not exists public.lg_admins (
  id          uuid primary key default gen_random_uuid(),
  login_id    text unique not null,
  name        text not null,
  pw_hash     text not null,
  must_change boolean not null default true,
  fail_count  int not null default 0,
  locked_until timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.lg_drivers (
  id          uuid primary key default gen_random_uuid(),
  login_id    text unique not null,
  name        text not null,
  manager     text not null default '',
  pin_hash    text not null,
  must_change boolean not null default true,
  active      boolean not null default true,
  sort        int not null default 0,
  fail_count  int not null default 0,
  locked_until timestamptz,
  created_at  timestamptz not null default now()
);

-- 기사님 추가 정보 (예전에 설치했어도 다시 실행하면 칸이 추가됩니다)
alter table public.lg_drivers add column if not exists phone  text not null default '';
alter table public.lg_drivers add column if not exists car_no text not null default '';
alter table public.lg_drivers add column if not exists note   text not null default '';

create table if not exists public.lg_sessions (
  token      uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('driver','admin')),
  user_id    uuid not null,
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists public.lg_trips (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.lg_drivers(id),
  trip_date   date not null,
  from_name   text not null default '',
  client      text not null default '',
  dest        text not null default '',
  via1        text not null default '',
  via2        text not null default '',
  via3        text not null default '',
  via4        text not null default '',
  cnt         int not null default 1 check (cnt >= 0),
  per_run     numeric not null default 0 check (per_run >= 0),
  fuel        numeric not null default 0 check (fuel >= 0),
  start_time  text not null default '',
  end_time    text not null default '',
  night       numeric not null default 0 check (night >= 0),
  memo        text not null default '',
  entered_by  text not null default 'driver',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lg_trips_date_idx on public.lg_trips (trip_date);
create index if not exists lg_trips_driver_idx on public.lg_trips (driver_id, trip_date);

-- 표(테이블)는 앱에서 직접 못 읽게 막고, 아래 함수로만 접근합니다
alter table public.lg_admins   enable row level security;
alter table public.lg_drivers  enable row level security;
alter table public.lg_sessions enable row level security;
alter table public.lg_trips    enable row level security;
revoke all on public.lg_admins, public.lg_drivers, public.lg_sessions, public.lg_trips from anon, authenticated;

-- ---------- 내부 도우미 ----------
create or replace function public.lg__auth(p_token uuid, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  select user_id into v_uid from lg_sessions
   where token = p_token and expires_at > now() and (p_role is null or role = p_role);
  if v_uid is null then raise exception 'SESSION_EXPIRED'; end if;
  if p_role = 'driver' and not exists(select 1 from lg_drivers where id = v_uid and active) then
    raise exception 'SESSION_EXPIRED';
  end if;
  return v_uid;
end $$;

create or replace function public.lg__role(p_token uuid)
returns text language sql security definer set search_path = public as $$
  select role from lg_sessions where token = p_token and expires_at > now()
$$;

create or replace function public.lg__trip_json(t lg_trips)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'driver_id', t.driver_id, 'trip_date', t.trip_date,
    'from_name', t.from_name, 'client', t.client, 'dest', t.dest,
    'via1', t.via1, 'via2', t.via2, 'via3', t.via3, 'via4', t.via4,
    'cnt', t.cnt, 'per_run', t.per_run, 'fuel', t.fuel,
    'start_time', t.start_time, 'end_time', t.end_time, 'night', t.night,
    'memo', t.memo, 'entered_by', t.entered_by,
    'created_at', t.created_at, 'updated_at', t.updated_at)
$$;


-- ---------- 로그인 / 로그아웃 / 내 정보 ----------
-- 틀린 횟수 기록이 지워지지 않도록, 로그인 실패는 오류 대신 {"error": ...} 로 돌려줍니다
create or replace function public.lg_login(p_role text, p_login text, p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid; v_name text; v_login text; v_hash text; v_must boolean; v_mgr text;
  v_locked timestamptz; v_token uuid;
begin
  delete from lg_sessions where expires_at < now();
  if p_role = 'admin' then
    select id, name, login_id, pw_hash, must_change, null, locked_until
      into v_id, v_name, v_login, v_hash, v_must, v_mgr, v_locked
      from lg_admins where login_id = trim(p_login);
  elsif p_role = 'driver' then
    select id, name, login_id, pin_hash, must_change, manager, locked_until
      into v_id, v_name, v_login, v_hash, v_must, v_mgr, v_locked
      from lg_drivers where login_id = trim(p_login) and active;
  else
    return jsonb_build_object('error', 'BAD_ROLE');
  end if;

  if v_id is null then return jsonb_build_object('error', 'LOGIN_FAILED'); end if;
  if v_locked is not null and v_locked > now() then
    return jsonb_build_object('error', 'LOCKED', 'until', v_locked);
  end if;

  if v_hash = crypt(coalesce(p_secret, ''), v_hash) then
    if p_role = 'admin' then update lg_admins  set fail_count = 0, locked_until = null where id = v_id;
    else                     update lg_drivers set fail_count = 0, locked_until = null where id = v_id; end if;
    insert into lg_sessions(role, user_id) values (p_role, v_id) returning token into v_token;
    return jsonb_build_object('token', v_token, 'role', p_role, 'id', v_id, 'name', v_name,
                              'login_id', v_login, 'must_change', v_must, 'manager', v_mgr);
  end if;

  -- 5번 연속 틀리면 10분 잠금
  if p_role = 'admin' then
    update lg_admins set
      locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' end,
      fail_count   = case when fail_count + 1 >= 5 then 0 else fail_count + 1 end
     where id = v_id;
  else
    update lg_drivers set
      locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' end,
      fail_count   = case when fail_count + 1 >= 5 then 0 else fail_count + 1 end
     where id = v_id;
  end if;
  return jsonb_build_object('error', 'LOGIN_FAILED');
end $$;

create or replace function public.lg_logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from lg_sessions where token = p_token
$$;

create or replace function public.lg_me(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid; r jsonb;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  if v_role = 'admin' then
    select jsonb_build_object('role','admin','id',id,'name',name,'login_id',login_id,'must_change',must_change)
      into r from lg_admins where id = v_uid;
  else
    select jsonb_build_object('role','driver','id',id,'name',name,'login_id',login_id,'must_change',must_change,'manager',manager)
      into r from lg_drivers where id = v_uid;
  end if;
  if r is null then raise exception 'SESSION_EXPIRED'; end if;
  return r;
end $$;

-- 본인 비밀번호(PIN) 변경
create or replace function public.lg_change_secret(p_token uuid, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid; v_hash text;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  if v_role = 'driver' then
    if p_new !~ '^[0-9]{4,6}$' then raise exception 'PIN_FORMAT'; end if;
    select pin_hash into v_hash from lg_drivers where id = v_uid;
    if v_hash <> crypt(coalesce(p_old,''), v_hash) then raise exception 'WRONG_OLD'; end if;
    update lg_drivers set pin_hash = crypt(p_new, gen_salt('bf')), must_change = false where id = v_uid;
  else
    if length(coalesce(p_new,'')) < 6 then raise exception 'PW_FORMAT'; end if;
    select pw_hash into v_hash from lg_admins where id = v_uid;
    if v_hash <> crypt(coalesce(p_old,''), v_hash) then raise exception 'WRONG_OLD'; end if;
    update lg_admins set pw_hash = crypt(p_new, gen_salt('bf')), must_change = false where id = v_uid;
  end if;
end $$;

-- ---------- 운행 내역 ----------
-- 월별 목록: 기사님은 본인 것만, 관리자는 전체
create or replace function public.lg_trips(p_token uuid, p_month text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid; v_from date; v_to date;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  v_from := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_to   := (v_from + interval '1 month')::date;
  return coalesce((
    select jsonb_agg(lg__trip_json(t) order by t.trip_date, t.created_at)
      from lg_trips t
     where t.trip_date >= v_from and t.trip_date < v_to
       and (v_role = 'admin' or t.driver_id = v_uid)), '[]'::jsonb);
end $$;

-- 최근 입력 1건 (지난 입력 복사용)
create or replace function public.lg_last_trip(p_token uuid, p_driver uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid; v_did uuid; r jsonb;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  v_did := case when v_role = 'admin' then p_driver else v_uid end;
  select lg__trip_json(t) into r from lg_trips t where t.driver_id = v_did
   order by t.trip_date desc, t.created_at desc limit 1;
  return r;
end $$;

-- 자주 쓰는 장소 목록 (자동완성용)
create or replace function public.lg_places(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  return coalesce((select jsonb_agg(p) from (
    select p, count(*) c from (
      select unnest(array[from_name, client, dest, via1, via2, via3, via4]) p
        from lg_trips where trip_date > now() - interval '180 days'
         and (v_role = 'admin' or driver_id = v_uid)) x
     where p <> '' group by p order by c desc limit 150) y), '[]'::jsonb);
end $$;

-- 저장 (p_trip.id 가 있으면 수정, 없으면 새로 추가)
create or replace function public.lg_trip_save(p_token uuid, p_trip jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid; v_did uuid; v_id uuid; t lg_trips;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  if v_role = 'admin' then
    v_did := (p_trip->>'driver_id')::uuid;
    if not exists(select 1 from lg_drivers where id = v_did) then raise exception 'NO_DRIVER'; end if;
  else
    v_did := v_uid;
  end if;
  if coalesce(p_trip->>'trip_date','') = '' then raise exception 'NO_DATE'; end if;
  v_id := nullif(p_trip->>'id','')::uuid;

  if v_id is null then
    insert into lg_trips(driver_id, trip_date, from_name, client, dest, via1, via2, via3, via4,
                         cnt, per_run, fuel, start_time, end_time, night, memo, entered_by)
    values (v_did, (p_trip->>'trip_date')::date,
      coalesce(p_trip->>'from_name',''), coalesce(p_trip->>'client',''), coalesce(p_trip->>'dest',''),
      coalesce(p_trip->>'via1',''), coalesce(p_trip->>'via2',''), coalesce(p_trip->>'via3',''), coalesce(p_trip->>'via4',''),
      coalesce((p_trip->>'cnt')::int, 1), coalesce((p_trip->>'per_run')::numeric, 0), coalesce((p_trip->>'fuel')::numeric, 0),
      coalesce(p_trip->>'start_time',''), coalesce(p_trip->>'end_time',''), coalesce((p_trip->>'night')::numeric, 0),
      coalesce(p_trip->>'memo',''), v_role)
    returning * into t;
  else
    update lg_trips set
      driver_id = v_did, trip_date = (p_trip->>'trip_date')::date,
      from_name = coalesce(p_trip->>'from_name',''), client = coalesce(p_trip->>'client',''), dest = coalesce(p_trip->>'dest',''),
      via1 = coalesce(p_trip->>'via1',''), via2 = coalesce(p_trip->>'via2',''), via3 = coalesce(p_trip->>'via3',''), via4 = coalesce(p_trip->>'via4',''),
      cnt = coalesce((p_trip->>'cnt')::int, 1), per_run = coalesce((p_trip->>'per_run')::numeric, 0), fuel = coalesce((p_trip->>'fuel')::numeric, 0),
      start_time = coalesce(p_trip->>'start_time',''), end_time = coalesce(p_trip->>'end_time',''), night = coalesce((p_trip->>'night')::numeric, 0),
      memo = coalesce(p_trip->>'memo',''), updated_at = now()
     where id = v_id and (v_role = 'admin' or driver_id = v_uid)
    returning * into t;
    if t.id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return lg__trip_json(t);
end $$;

create or replace function public.lg_trip_delete(p_token uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := lg__role(p_token); v_uid uuid;
begin
  if v_role is null then raise exception 'SESSION_EXPIRED'; end if;
  v_uid := lg__auth(p_token, v_role);
  delete from lg_trips where id = p_id and (v_role = 'admin' or driver_id = v_uid);
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- ---------- 기사님 계정 (관리자 전용) ----------
create or replace function public.lg_drivers_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lg__auth(p_token, 'admin');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'login_id', d.login_id, 'name', d.name, 'manager', d.manager, 'active', d.active,
      'sort', d.sort, 'must_change', d.must_change, 'phone', d.phone, 'car_no', d.car_no, 'note', d.note,
      'locked', (d.locked_until is not null and d.locked_until > now()),
      'last_trip', (select max(trip_date) from lg_trips t where t.driver_id = d.id),
      'trip_count', (select count(*) from lg_trips t where t.driver_id = d.id),
      'created_at', d.created_at)
      order by d.manager, d.sort, d.name) from lg_drivers d), '[]'::jsonb);
end $$;

-- 추가/수정. p_driver.pin 을 넣으면 PIN 초기화(기사님이 다음 로그인 때 새 PIN으로 바꿈)
create or replace function public.lg_driver_save(p_token uuid, p_driver jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := nullif(p_driver->>'id','')::uuid; v_pin text := nullif(p_driver->>'pin','');
begin
  perform lg__auth(p_token, 'admin');
  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_FORMAT'; end if;
  if coalesce(trim(p_driver->>'login_id'),'') = '' or coalesce(trim(p_driver->>'name'),'') = '' then raise exception 'REQUIRED'; end if;
  if exists(select 1 from lg_drivers where login_id = trim(p_driver->>'login_id') and id is distinct from v_id) then
    raise exception 'DUP_LOGIN';
  end if;
  if v_id is null then
    if v_pin is null then raise exception 'PIN_FORMAT'; end if;
    insert into lg_drivers(login_id, name, manager, pin_hash, sort, phone, car_no, note)
    values (trim(p_driver->>'login_id'), trim(p_driver->>'name'), coalesce(trim(p_driver->>'manager'),''),
            crypt(v_pin, gen_salt('bf')),
            coalesce((p_driver->>'sort')::int, (select coalesce(max(sort),0)+1 from lg_drivers)),
            coalesce(trim(p_driver->>'phone'),''), coalesce(trim(p_driver->>'car_no'),''), coalesce(trim(p_driver->>'note'),''));
  else
    update lg_drivers set
      login_id = trim(p_driver->>'login_id'), name = trim(p_driver->>'name'),
      manager = coalesce(trim(p_driver->>'manager'),''),
      phone = coalesce(trim(p_driver->>'phone'), phone),
      car_no = coalesce(trim(p_driver->>'car_no'), car_no),
      note = coalesce(trim(p_driver->>'note'), note),
      active = coalesce((p_driver->>'active')::boolean, active),
      sort = coalesce((p_driver->>'sort')::int, sort),
      pin_hash = case when v_pin is null then pin_hash else crypt(v_pin, gen_salt('bf')) end,
      must_change = case when v_pin is null then must_change else true end,
      fail_count = case when v_pin is null then fail_count else 0 end,
      locked_until = case when v_pin is null then locked_until else null end
     where id = v_id;
    if not (coalesce((p_driver->>'active')::boolean, true)) then
      delete from lg_sessions where user_id = v_id;
    end if;
  end if;
end $$;

-- 기사님 삭제 (관리자 전용). 운행 내역이 있으면 p_with_trips = true 일 때만 내역까지 함께 삭제
create or replace function public.lg_driver_delete(p_token uuid, p_id uuid, p_with_trips boolean default false)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lg__auth(p_token, 'admin');
  if not exists(select 1 from lg_drivers where id = p_id) then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from lg_trips where driver_id = p_id) then
    if not coalesce(p_with_trips, false) then raise exception 'HAS_TRIPS'; end if;
    delete from lg_trips where driver_id = p_id;
  end if;
  delete from lg_sessions where user_id = p_id and role = 'driver';
  delete from lg_drivers where id = p_id;
end $$;

-- 월별·기사님별 합계 (대시보드 추이용, 관리자 전용)  p_from / p_to = 'YYYY-MM'
create or replace function public.lg_summary(p_token uuid, p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform lg__auth(p_token, 'admin');
  return coalesce((select jsonb_agg(x order by x->>'month', x->>'driver_id') from (
    select jsonb_build_object('month', to_char(trip_date,'YYYY-MM'), 'driver_id', driver_id,
           'n', count(*), 'cnt', sum(cnt), 'total', sum(cnt*per_run + cnt*fuel + night)) x
      from lg_trips
     where trip_date >= to_date(p_from||'-01','YYYY-MM-DD')
       and trip_date <  (to_date(p_to||'-01','YYYY-MM-DD') + interval '1 month')
     group by to_char(trip_date,'YYYY-MM'), driver_id) y), '[]'::jsonb);
end $$;

-- ---------- 실행 권한: 앱(anon)은 lg_ 함수만 쓸 수 있음 ----------
revoke all on function public.lg__auth(uuid, text), public.lg__role(uuid), public.lg__trip_json(lg_trips) from public, anon, authenticated;
grant execute on function
  public.lg_login(text, text, text), public.lg_logout(uuid), public.lg_me(uuid),
  public.lg_change_secret(uuid, text, text), public.lg_trips(uuid, text), public.lg_last_trip(uuid, uuid),
  public.lg_places(uuid), public.lg_trip_save(uuid, jsonb), public.lg_trip_delete(uuid, uuid),
  public.lg_drivers_list(uuid), public.lg_driver_save(uuid, jsonb), public.lg_summary(uuid, text, text), public.lg_driver_delete(uuid, uuid, boolean)
to anon, authenticated;

-- ---------- 처음 계정 ----------
-- 관리자: 아이디 admin / 비밀번호 shinshin1234  (처음 로그인하면 새 비밀번호로 바꾸라고 나옵니다)
insert into public.lg_admins(login_id, name, pw_hash)
values ('admin', '안봉국', extensions.crypt('shinshin1234', extensions.gen_salt('bf')))
on conflict (login_id) do nothing;

-- 기사님 8명: 아이디 = 이름, 처음 PIN = 0000 (처음 로그인하면 본인 PIN으로 바꿈)
insert into public.lg_drivers(login_id, name, manager, pin_hash, sort) values
  ('김희정', '김희정', '안봉국', extensions.crypt('0000', extensions.gen_salt('bf')), 1),
  ('허두영', '허두영', '안봉국', extensions.crypt('0000', extensions.gen_salt('bf')), 2),
  ('김경덕', '김경덕', '안봉국', extensions.crypt('0000', extensions.gen_salt('bf')), 3),
  ('김학렬', '김학렬', '최귀만', extensions.crypt('0000', extensions.gen_salt('bf')), 4),
  ('박성형', '박성형', '최귀만', extensions.crypt('0000', extensions.gen_salt('bf')), 5),
  ('서춘근', '서춘근', '최귀만', extensions.crypt('0000', extensions.gen_salt('bf')), 6),
  ('유재영', '유재영', '최귀만', extensions.crypt('0000', extensions.gen_salt('bf')), 7),
  ('하종규', '하종규', '최귀만', extensions.crypt('0000', extensions.gen_salt('bf')), 8)
on conflict (login_id) do nothing;
