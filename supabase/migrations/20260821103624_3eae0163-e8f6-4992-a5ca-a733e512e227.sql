create or replace function public.admin_list_candidatos_catalogo()
returns table (
  ean text,
  nome text,
  embalagem text,
  fator_embalagem integer,
  origens text[],
  ocorrencias integer,
  ultimo_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  with base as (
    select
      regexp_replace(i.ean, '\D', '', 'g') as ean_norm,
      i.nome,
      i.embalagem,
      i.fator_embalagem,
      'itens_faltantes'::text as origem,
      i.created_at
    from itens_faltantes i
    where i.ean is not null
      and i.catalogo_mestre_id is null
      and length(regexp_replace(i.ean, '\D', '', 'g')) in (8, 12, 13, 14)
    union all
    select
      regexp_replace(p.ean, '\D', '', 'g') as ean_norm,
      p.nome,
      p.embalagem,
      p.fator_embalagem,
      'produtos'::text as origem,
      p.created_at
    from produtos p
    where p.ean is not null
      and length(regexp_replace(p.ean, '\D', '', 'g')) in (8, 12, 13, 14)
  ),
  filtrado as (
    select b.*
    from base b
    where not exists (
      select 1 from catalogo_mestre c
      where regexp_replace(coalesce(c.ean, ''), '\D', '', 'g') = b.ean_norm
    )
  ),
  ranked as (
    select f.*,
      row_number() over (partition by f.ean_norm order by f.created_at desc) as rn
    from filtrado f
  )
  select
    r.ean_norm as ean,
    max(case when r.rn = 1 then r.nome end) as nome,
    max(case when r.rn = 1 then r.embalagem end) as embalagem,
    max(case when r.rn = 1 then r.fator_embalagem end)::integer as fator_embalagem,
    array_agg(distinct r.origem) as origens,
    count(*)::integer as ocorrencias,
    max(r.created_at) as ultimo_em
  from ranked r
  group by r.ean_norm
  order by max(r.created_at) desc;
end;
$$;

revoke all on function public.admin_list_candidatos_catalogo() from public;
grant execute on function public.admin_list_candidatos_catalogo() to authenticated;