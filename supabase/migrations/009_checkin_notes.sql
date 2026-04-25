alter table check_ins
  add column if not exists note text check (char_length(note) <= 100);
