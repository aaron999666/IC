alter table public.bom_parse_lines
  add column if not exists parsed_package_type text;
