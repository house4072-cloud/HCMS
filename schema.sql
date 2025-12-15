-- HCMS 기본 스키마
create table if not exists cranes (
  id uuid primary key default gen_random_uuid(),
  crane_no text not null,
  type text,
  location text,
  created_at timestamptz default now()
);
