create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists career_profiles (
  user_id text primary key references users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists uploaded_documents (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  filename text not null,
  text_content text not null,
  created_at timestamptz not null default now()
);

create table if not exists generated_cvs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  job_title text not null,
  template text not null,
  job_description text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists ai_requests (
  id text primary key,
  user_id text references users(id) on delete set null,
  feature text not null,
  model text not null,
  success boolean not null,
  error text,
  created_at timestamptz not null default now()
);
