-- 012_avatar.sql
-- Adds avatar_kind column to profiles so users can choose their sprite character.

alter table profiles
  add column if not exists avatar_kind text
  not null default 'fox'
  check (avatar_kind in ('fox', 'cat', 'rabbit', 'raccoon'));
