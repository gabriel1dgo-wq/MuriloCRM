-- Pixote CRM v2: armazém (locais + caixas), fotos, ficha completa da sucata,
-- OS detalhada com assinatura, taxas de marketplace, contas a pagar/receber e meta mensal.
-- Aplica-se DEPOIS de 20260927184355_zenith_core.sql. Não remove dados existentes.
-- Os nomes internos z_* / zenith_private são mantidos por compatibilidade.
begin;

-- ---------------------------------------------------------------- armazém
create table public.z_locations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 code text not null check(length(trim(code)) between 1 and 20), name text not null check(length(trim(name)) between 1 and 80),
 kind text not null default 'prateleira' check(kind in ('prateleira','gaveteiro','pallet','area')),
 levels integer not null default 4 check(levels between 1 and 12),
 color text not null default 'amber' check(color in ('amber','orange','blue','green','red','steel')),
 archived boolean not null default false,
 unique(owner_id,code), unique(owner_id,id)
);
create table public.z_boxes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 code text not null check(length(trim(code)) between 1 and 20), label text not null default '' check(length(label) <= 80),
 location_id uuid not null, level integer not null default 1 check(level between 1 and 12),
 archived boolean not null default false,
 unique(owner_id,code), unique(owner_id,id), foreign key(owner_id,location_id) references public.z_locations(owner_id,id)
);

alter table public.z_parts
 add column box_id uuid,
 add column photos jsonb not null default '[]' check(jsonb_typeof(photos)='array' and jsonb_array_length(photos) <= 6),
 add column oem text not null default '' check(length(oem) <= 80),
 add column fits text not null default '' check(length(fits) <= 500),
 add constraint z_parts_box_fk foreign key(owner_id,box_id) references public.z_boxes(owner_id,id);

-- ---------------------------------------------------------------- sucatas
alter table public.z_scraps
 add column brand text not null default '' check(length(brand) <= 60),
 add column model text not null default '' check(length(model) <= 100),
 add column color text not null default '' check(length(color) <= 40),
 add column fuel text not null default '' check(length(fuel) <= 30),
 add column km integer check(km between 0 and 5000000),
 add column chassis text not null default '' check(length(chassis) <= 30),
 add column renavam text not null default '' check(length(renavam) <= 20),
 add column engine text not null default '' check(length(engine) <= 60),
 add column origin text not null default 'particular' check(origin in ('leilao','particular','seguradora','troca','outro')),
 add column lot text not null default '' check(length(lot) <= 60),
 add column supplier_id uuid,
 add column detran text not null default 'pendente' check(detran in ('pendente','em_andamento','baixado')),
 add column photos jsonb not null default '[]' check(jsonb_typeof(photos)='array' and jsonb_array_length(photos) <= 12),
 add constraint z_scraps_supplier_fk foreign key(owner_id,supplier_id) references public.z_contacts(owner_id,id);

-- ---------------------------------------------------------------- vendas e oficina
alter table public.z_orders
 add column number integer,
 add column fee bigint not null default 0 check(fee between 0 and 10000000000),
 add column external_ref text not null default '' check(length(external_ref) <= 60),
 add column km integer check(km between 0 and 5000000),
 add column fuel_level text not null default '' check(fuel_level in ('','reserva','1/4','1/2','3/4','cheio')),
 add column complaint text not null default '' check(length(complaint) <= 2000),
 add column diagnosis text not null default '' check(length(diagnosis) <= 4000),
 add column services jsonb not null default '[]' check(jsonb_typeof(services)='array' and jsonb_array_length(services) <= 50),
 add column external_parts jsonb not null default '[]' check(jsonb_typeof(external_parts)='array' and jsonb_array_length(external_parts) <= 50),
 add column checklist jsonb not null default '[]' check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist) <= 40),
 add column recommendations text not null default '' check(length(recommendations) <= 2000),
 add column warranty_days integer not null default 90 check(warranty_days between 0 and 3650),
 add column signature text not null default '' check(signature = '' or (signature like 'data:image/png;base64,%' and length(signature) <= 180000)),
 add column signed_name text not null default '' check(length(signed_name) <= 160),
 add column signed_at timestamptz;
update public.z_orders o set number = x.n
 from (select id, row_number() over (partition by owner_id, kind order by created_at, id) as n from public.z_orders) x where o.id = x.id;
alter table public.z_orders alter column number set not null, add constraint z_orders_number_key unique(owner_id,kind,number);

alter table public.z_cash drop constraint z_cash_source_check,
 add constraint z_cash_source_check check(source in ('manual','venda','oficina','sucata','estorno','conta'));

alter table public.z_settings
 add column monthly_goal bigint not null default 0 check(monthly_goal between 0 and 10000000000),
 add column warranty_text text not null default '' check(length(warranty_text) <= 2000);

-- ---------------------------------------------------------------- contas a pagar/receber
create table public.z_bills (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 description text not null check(length(trim(description)) between 1 and 200), direction text not null check(direction in ('pagar','receber')),
 amount bigint not null check(amount between 1 and 10000000000), due_date date not null, category text not null default 'Outros',
 contact_id uuid, status text not null default 'aberta' check(status in ('aberta','paga','cancelada')), cash_id uuid, notes text not null default '' check(length(notes) <= 1000),
 unique(owner_id,id), foreign key(owner_id,contact_id) references public.z_contacts(owner_id,id), foreign key(owner_id,cash_id) references public.z_cash(owner_id,id)
);

do $$ declare t text; begin
 foreach t in array array['z_locations','z_boxes','z_bills'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant select on public.%I to authenticated', t);
  execute format('create policy owner_read on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
  execute format('create index %I on public.%I(owner_id)', t || '_owner_idx', t);
 end loop;
end $$;
create index z_parts_box_idx on public.z_parts(owner_id,box_id);
create index z_boxes_location_idx on public.z_boxes(owner_id,location_id);
create index z_bills_due_idx on public.z_bills(owner_id,status,due_date);

-- ---------------------------------------------------------------- validações auxiliares
create function zenith_private.valid_photos(u uuid, v jsonb, max_count integer) returns boolean
language sql immutable set search_path = '' as $$
 select v is null or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= max_count and not exists(
  select 1 from jsonb_array_elements(v) e
  where jsonb_typeof(e) <> 'string' or length(e #>> '{}') > 300 or left(e #>> '{}', 37) <> u::text || '/'));
$$;
revoke all on function zenith_private.valid_photos(uuid,jsonb,integer) from public, anon;

-- ---------------------------------------------------------------- executor
create or replace function zenith_private.command(request_id uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); p jsonb := payload; record_id uuid; old_cost bigint := 0; amount_value bigint; total_value bigint := 0; labor_value bigint; discount_value bigint; fee_value bigint := 0;
 part public.z_parts%rowtype; ord public.z_orders%rowtype; entry public.z_cash%rowtype; bill public.z_bills%rowtype; item jsonb; q integer; price_value bigint; result_value jsonb; existing zenith_private.requests%rowtype;
 new_status text; next_number integer; new_cash_id uuid; business_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if u is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
 if request_id is null or action is null or jsonb_typeof(p) is distinct from 'object' or length(p::text) > 200000 then raise exception 'Requisição inválida.'; end if;
 -- Serializa mutações curtas por conta: evita venda dupla da mesma peça e reenvios concorrentes.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into existing from zenith_private.requests r where r.owner_id=u and r.request_id=command.request_id;
 if found then
  if existing.body <> jsonb_build_object('action',action,'payload',p) then raise exception 'Identificador já utilizado em outra operação.'; end if;
  return existing.result;
 end if;
 record_id := coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());

 if action='contact.save' then
  if p->>'id' is not null and not exists(select 1 from public.z_contacts where id=record_id and owner_id=u) then raise exception 'Cadastro não encontrado.'; end if;
  insert into public.z_contacts(id,owner_id,name,kind,phone,email,document,notes,archived)
  values(record_id,u,trim(p->>'name'),p->>'kind',coalesce(p->>'phone',''),coalesce(p->>'email',''),coalesce(p->>'document',''),coalesce(p->>'notes',''),coalesce((p->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,kind=excluded.kind,phone=excluded.phone,email=excluded.email,document=excluded.document,notes=excluded.notes,archived=excluded.archived where z_contacts.owner_id=u;

 elsif action='location.save' then
  if p->>'id' is not null and not exists(select 1 from public.z_locations where id=record_id and owner_id=u) then raise exception 'Local não encontrado.'; end if;
  if coalesce((p->>'archived')::boolean,false) and exists(select 1 from public.z_boxes where owner_id=u and location_id=record_id and not archived) then raise exception 'Mova ou arquive as caixas deste local antes de arquivá-lo.'; end if;
  if exists(select 1 from public.z_boxes where owner_id=u and location_id=record_id and not archived and level > (p->>'levels')::integer) then raise exception 'Existem caixas em níveis acima do novo limite.'; end if;
  insert into public.z_locations(id,owner_id,code,name,kind,levels,color,archived)
  values(record_id,u,upper(trim(p->>'code')),trim(p->>'name'),coalesce(p->>'kind','prateleira'),(p->>'levels')::integer,coalesce(p->>'color','amber'),coalesce((p->>'archived')::boolean,false))
  on conflict(id) do update set code=excluded.code,name=excluded.name,kind=excluded.kind,levels=excluded.levels,color=excluded.color,archived=excluded.archived where z_locations.owner_id=u;

 elsif action='box.save' then
  if p->>'id' is not null and not exists(select 1 from public.z_boxes where id=record_id and owner_id=u) then raise exception 'Caixa não encontrada.'; end if;
  if not exists(select 1 from public.z_locations where id=(p->>'location_id')::uuid and owner_id=u and not archived and levels >= (p->>'level')::integer) then raise exception 'Local ou nível inválido.'; end if;
  if coalesce((p->>'archived')::boolean,false) and exists(select 1 from public.z_parts where owner_id=u and box_id=record_id and not archived and quantity > 0) then raise exception 'A caixa ainda contém peças. Mova-as antes de arquivar.'; end if;
  insert into public.z_boxes(id,owner_id,code,label,location_id,level,archived)
  values(record_id,u,upper(trim(p->>'code')),coalesce(trim(p->>'label'),''),(p->>'location_id')::uuid,(p->>'level')::integer,coalesce((p->>'archived')::boolean,false))
  on conflict(id) do update set code=excluded.code,label=excluded.label,location_id=excluded.location_id,level=excluded.level,archived=excluded.archived where z_boxes.owner_id=u;

 elsif action='scrap.save' then
  if p->>'id' is not null then select cost into old_cost from public.z_scraps where id=record_id and owner_id=u; if not found then raise exception 'Sucata não encontrada.'; end if; end if;
  if not zenith_private.valid_photos(u,p->'photos',12) then raise exception 'Fotos inválidas.'; end if;
  if nullif(p->>'supplier_id','') is not null and not exists(select 1 from public.z_contacts where id=(p->>'supplier_id')::uuid and owner_id=u) then raise exception 'Fornecedor não encontrado.'; end if;
  insert into public.z_scraps(id,owner_id,code,vehicle,plate,year,cost,date,status,notes,brand,model,color,fuel,km,chassis,renavam,engine,origin,lot,supplier_id,detran,photos)
  values(record_id,u,trim(p->>'code'),trim(p->>'vehicle'),coalesce(p->>'plate',''),(p->>'year')::integer,(p->>'cost')::bigint,(p->>'date')::date,p->>'status',coalesce(p->>'notes',''),
   coalesce(p->>'brand',''),coalesce(p->>'model',''),coalesce(p->>'color',''),coalesce(p->>'fuel',''),nullif(p->>'km','')::integer,upper(coalesce(p->>'chassis','')),coalesce(p->>'renavam',''),coalesce(p->>'engine',''),
   coalesce(p->>'origin','particular'),coalesce(p->>'lot',''),nullif(p->>'supplier_id','')::uuid,coalesce(p->>'detran','pendente'),coalesce(p->'photos','[]'::jsonb))
  on conflict(id) do update set code=excluded.code,vehicle=excluded.vehicle,plate=excluded.plate,year=excluded.year,cost=excluded.cost,date=excluded.date,status=excluded.status,notes=excluded.notes,
   brand=excluded.brand,model=excluded.model,color=excluded.color,fuel=excluded.fuel,km=excluded.km,chassis=excluded.chassis,renavam=excluded.renavam,engine=excluded.engine,origin=excluded.origin,lot=excluded.lot,
   supplier_id=excluded.supplier_id,detran=excluded.detran,photos=excluded.photos where z_scraps.owner_id=u;
  amount_value := old_cost - (p->>'cost')::bigint;
  if amount_value <> 0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Aquisição '||(p->>'code'),amount_value,case when p->>'id' is null then (p->>'date')::date else business_date end,'Sucatas','Transferência','sucata',record_id); end if;

 elsif action='part.save' then
  if p->>'id' is not null then select * into part from public.z_parts where id=record_id and owner_id=u; if not found then raise exception 'Peça não encontrada.'; end if; end if;
  if coalesce((p->>'archived')::boolean,false) and exists(select 1 from public.z_order_items i join public.z_orders o on o.id=i.order_id where i.owner_id=u and i.part_id=record_id and o.kind='oficina' and o.status not in ('entregue','cancelada')) then raise exception 'A peça está reservada em uma OS em andamento.'; end if;
  if not zenith_private.valid_photos(u,p->'photos',6) then raise exception 'Fotos inválidas.'; end if;
  if nullif(p->>'box_id','') is not null and not exists(select 1 from public.z_boxes where id=(p->>'box_id')::uuid and owner_id=u and not archived) then raise exception 'Caixa não encontrada.'; end if;
  insert into public.z_parts(id,owner_id,code,name,category,scrap_id,quantity,minimum,cost,price,location,condition,archived,box_id,photos,oem,fits)
  values(record_id,u,trim(p->>'code'),trim(p->>'name'),coalesce(p->>'category',''),nullif(p->>'scrap_id','')::uuid,case when p->>'id' is null then (p->>'quantity')::integer else part.quantity end,(p->>'minimum')::integer,(p->>'cost')::bigint,(p->>'price')::bigint,coalesce(p->>'location',''),p->>'condition',coalesce((p->>'archived')::boolean,false),
   nullif(p->>'box_id','')::uuid,coalesce(p->'photos','[]'::jsonb),coalesce(p->>'oem',''),coalesce(p->>'fits',''))
  on conflict(id) do update set code=excluded.code,name=excluded.name,category=excluded.category,scrap_id=excluded.scrap_id,minimum=excluded.minimum,cost=excluded.cost,price=excluded.price,location=excluded.location,condition=excluded.condition,archived=excluded.archived,
   box_id=excluded.box_id,photos=excluded.photos,oem=excluded.oem,fits=excluded.fits where z_parts.owner_id=u;
  if p->>'id' is null and (p->>'quantity')::integer > 0 then insert into public.z_stock_moves(owner_id,part_id,delta,reason) values(u,record_id,(p->>'quantity')::integer,'Estoque inicial'); end if;

 elsif action='part.move' then
  if nullif(p->>'box_id','') is not null and not exists(select 1 from public.z_boxes where id=(p->>'box_id')::uuid and owner_id=u and not archived) then raise exception 'Caixa não encontrada.'; end if;
  update public.z_parts set box_id=nullif(p->>'box_id','')::uuid where id=record_id and owner_id=u and not archived;
  if not found then raise exception 'Peça não encontrada.'; end if;

 elsif action='stock.adjust' then
  q := (p->>'delta')::integer;
  if q is null or q=0 then raise exception 'Quantidade inválida.'; end if;
  update public.z_parts set quantity=quantity+q where id=record_id and owner_id=u and not archived and quantity+q >= 0;
  if not found then raise exception 'Peça indisponível ou estoque insuficiente.'; end if;
  insert into public.z_stock_moves(owner_id,part_id,delta,reason) values(u,record_id,q,trim(p->>'reason'));

 elsif action in ('order.create','order.update') then
  if action='order.create' and p->>'id' is not null then raise exception 'Nova operação não aceita ID existente.'; end if;
  if action='order.update' then
   select * into ord from public.z_orders where id=record_id and owner_id=u for update;
   if not found or ord.kind<>'oficina' or coalesce(p->>'kind','')<>'oficina' or ord.status in ('entregue','cancelada') then raise exception 'Somente ordens em andamento podem ser editadas.'; end if;
   for item in select to_jsonb(i) from public.z_order_items i where order_id=record_id and owner_id=u loop
    update public.z_parts set quantity=quantity+(item->>'quantity')::integer where id=(item->>'part_id')::uuid and owner_id=u;
    insert into public.z_stock_moves(owner_id,part_id,delta,reason,reference_id) values(u,(item->>'part_id')::uuid,(item->>'quantity')::integer,'Revisão de OS',record_id);
   end loop;
   delete from public.z_order_items where order_id=record_id and owner_id=u;
  end if;
  if coalesce(p->>'kind','') not in ('venda','oficina') then raise exception 'Tipo de operação inválido.'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' then raise exception 'Itens inválidos.'; end if;
  if jsonb_array_length(p->'items') > 100 or (p->>'kind'='venda' and jsonb_array_length(p->'items')=0) then raise exception 'Informe de 1 a 100 itens.'; end if;
  if p->>'contact_id' is not null and not exists(select 1 from public.z_contacts where id=(p->>'contact_id')::uuid and owner_id=u and (not archived or (action='order.update' and id=ord.contact_id))) then raise exception 'Cliente não encontrado.'; end if;
  if p ? 'services' and jsonb_typeof(p->'services') is distinct from 'array' then raise exception 'Serviços inválidos.'; end if;
  if p ? 'external_parts' and jsonb_typeof(p->'external_parts') is distinct from 'array' then raise exception 'Peças externas inválidas.'; end if;
  if p ? 'checklist' and (jsonb_typeof(p->'checklist') is distinct from 'array' or length((p->'checklist')::text) > 20000) then raise exception 'Checklist inválido.'; end if;
  if p->>'kind'='oficina' and jsonb_array_length(coalesce(p->'services','[]'::jsonb)) > 0 then
   -- Mão de obra = soma dos serviços executados.
   labor_value := 0;
   for item in select value from jsonb_array_elements(p->'services') loop
    price_value := (item->>'price')::bigint;
    if length(trim(coalesce(item->>'description',''))) not between 1 and 300 or length(coalesce(item->>'detail','')) > 2000 or price_value is null or price_value < 0 or price_value > 10000000000 then raise exception 'Serviço inválido.'; end if;
    labor_value := labor_value + price_value;
   end loop;
  else
   labor_value := case when p->>'kind'='oficina' then (p->>'labor')::bigint else 0 end;
  end if;
  discount_value := (p->>'discount')::bigint;
  fee_value := case when p->>'kind'='venda' then coalesce((p->>'fee')::bigint,0) else 0 end;
  total_value := labor_value-discount_value;
  for item in select value from jsonb_array_elements(p->'items') loop
   q := (item->>'quantity')::integer; price_value := (item->>'price')::bigint;
   if q is null or q<1 or q>1000000 or price_value is null or price_value<0 or price_value>10000000000 then raise exception 'Quantidade ou preço inválido.'; end if;
   total_value := total_value + q::bigint*price_value;
  end loop;
  if p->>'kind'='oficina' then
   for item in select value from jsonb_array_elements(coalesce(p->'external_parts','[]'::jsonb)) loop
    q := (item->>'quantity')::integer; price_value := coalesce((item->>'price')::bigint,0);
    if length(trim(coalesce(item->>'name',''))) not between 1 and 160 or q is null or q<1 or q>100000 or price_value<0 or price_value>10000000000
     or coalesce(item->>'origin','') not in ('cliente','comprada') then raise exception 'Peça externa inválida.'; end if;
    total_value := total_value + q::bigint*price_value;
   end loop;
  end if;
  if total_value < 0 then raise exception 'O desconto não pode superar o total.' using errcode='23514'; end if;
  if action='order.create' then
   select coalesce(max(number),0)+1 into next_number from public.z_orders where owner_id=u and kind=p->>'kind';
  end if;
  insert into public.z_orders(id,owner_id,kind,contact_id,customer,channel,payment,vehicle,plate,description,technician,due_date,status,labor,discount,total,
   number,fee,external_ref,km,fuel_level,complaint,diagnosis,services,external_parts,checklist,recommendations,warranty_days)
  values(record_id,u,p->>'kind',nullif(p->>'contact_id','')::uuid,trim(p->>'customer'),p->>'channel',p->>'payment',coalesce(p->>'vehicle',''),upper(coalesce(p->>'plate','')),coalesce(p->>'description',''),coalesce(p->>'technician',''),nullif(p->>'due_date','')::date,
   case when action='order.update' then ord.status when p->>'kind'='venda' then 'confirmada' else 'aberta' end,labor_value,discount_value,total_value,
   coalesce(next_number,ord.number),fee_value,coalesce(p->>'external_ref',''),nullif(p->>'km','')::integer,coalesce(p->>'fuel_level',''),coalesce(p->>'complaint',''),coalesce(p->>'diagnosis',''),
   case when p->>'kind'='oficina' then coalesce(p->'services','[]'::jsonb) else '[]'::jsonb end,case when p->>'kind'='oficina' then coalesce(p->'external_parts','[]'::jsonb) else '[]'::jsonb end,
   coalesce(p->'checklist','[]'::jsonb),coalesce(p->>'recommendations',''),coalesce((p->>'warranty_days')::integer,90))
  on conflict(id) do update set contact_id=excluded.contact_id,customer=excluded.customer,payment=excluded.payment,vehicle=excluded.vehicle,plate=excluded.plate,description=excluded.description,technician=excluded.technician,due_date=excluded.due_date,labor=excluded.labor,discount=excluded.discount,total=excluded.total,
   km=excluded.km,fuel_level=excluded.fuel_level,complaint=excluded.complaint,diagnosis=excluded.diagnosis,services=excluded.services,external_parts=excluded.external_parts,checklist=excluded.checklist,recommendations=excluded.recommendations,warranty_days=excluded.warranty_days where z_orders.owner_id=u;
  for item in select value from jsonb_array_elements(p->'items') loop
   select * into part from public.z_parts where id=(item->>'part_id')::uuid and owner_id=u and not archived for update;
   if not found then raise exception 'Peça não encontrada.'; end if;
   q := (item->>'quantity')::integer;
   if part.quantity<q then raise exception 'Estoque insuficiente: %.',part.name; end if;
   insert into public.z_order_items(owner_id,order_id,part_id,scrap_id,name,quantity,price) values(u,record_id,part.id,part.scrap_id,part.name,q,(item->>'price')::bigint);
   update public.z_parts set quantity=quantity-q where id=part.id and owner_id=u;
   insert into public.z_stock_moves(owner_id,part_id,delta,reason,reference_id) values(u,part.id,-q,case when p->>'kind'='venda' then 'Venda' else 'Reserva para OS' end,record_id);
  end loop;
  if p->>'kind'='venda' and total_value>0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Venda · '||(p->>'customer'),total_value,business_date,'Vendas',p->>'payment','venda',record_id); end if;
  if p->>'kind'='venda' and fee_value>0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Taxa '||case p->>'channel' when 'mercado_livre' then 'Mercado Livre' when 'shopee' then 'Shopee' else 'de venda' end||' · '||(p->>'customer'),-fee_value,business_date,'Taxas marketplace',p->>'payment','venda',record_id); end if;

 elsif action='order.status' then
  select * into ord from public.z_orders where id=record_id and owner_id=u for update;
  if not found then raise exception 'Registro não encontrado.'; end if;
  new_status := p->>'status';
  if new_status is null then raise exception 'Status inválido.'; end if;
  if ord.status<>new_status then
   if ord.status='cancelada' then raise exception 'Registro já cancelado.'; end if;
   if new_status='cancelada' then
    for item in select to_jsonb(i) from public.z_order_items i where order_id=record_id and owner_id=u loop
     update public.z_parts set quantity=quantity+(item->>'quantity')::integer where id=(item->>'part_id')::uuid and owner_id=u;
     insert into public.z_stock_moves(owner_id,part_id,delta,reason,reference_id) values(u,(item->>'part_id')::uuid,(item->>'quantity')::integer,'Cancelamento',record_id);
    end loop;
    insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id,reversal_of)
    select u,'Estorno · '||c.description,-c.amount,business_date,c.category,c.payment,'estorno',record_id,c.id from public.z_cash c
    where c.owner_id=u and c.reference_id=record_id and c.reversal_of is null and not exists(select 1 from public.z_cash r where r.reversal_of=c.id);
   else
    if ord.kind<>'oficina' or ord.status='entregue' or new_status not in ('aberta','analise','aguardando_peca','execucao','finalizada','entregue') then raise exception 'Transição não permitida.'; end if;
    if new_status='entregue' and ord.total>0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Oficina · OS '||lpad(ord.number::text,4,'0')||' · '||ord.customer,ord.total,business_date,'Oficina',ord.payment,'oficina',record_id); end if;
   end if;
   update public.z_orders set status=new_status where id=record_id and owner_id=u;
  end if;

 elsif action='order.sign' then
  select * into ord from public.z_orders where id=record_id and owner_id=u and kind='oficina' for update;
  if not found or ord.status='cancelada' then raise exception 'Ordem de serviço indisponível para assinatura.'; end if;
  if length(trim(coalesce(p->>'signed_name',''))) not between 1 and 160 or coalesce(p->>'signature','') not like 'data:image/png;base64,%' then raise exception 'Assinatura inválida.'; end if;
  update public.z_orders set signature=p->>'signature',signed_name=trim(p->>'signed_name'),signed_at=now() where id=record_id and owner_id=u;

 elsif action='cash.create' then
  if coalesce(p->>'direction','') not in ('entrada','saida') or (p->>'amount')::bigint <= 0 then raise exception 'Valor ou tipo inválido.'; end if;
  amount_value := (p->>'amount')::bigint * case when p->>'direction'='saida' then -1 else 1 end;
  insert into public.z_cash(id,owner_id,description,amount,date,category,payment,source) values(record_id,u,trim(p->>'description'),amount_value,(p->>'date')::date,p->>'category',p->>'payment','manual');

 elsif action='cash.reverse' then
  select * into entry from public.z_cash where id=record_id and owner_id=u and source in ('manual','conta');
  if not found then raise exception 'Lançamento manual não encontrado.'; end if;
  insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reversal_of) values(u,'Estorno · '||entry.description,-entry.amount,business_date,entry.category,entry.payment,'estorno',entry.id);
  -- Estornar a baixa de uma conta a reabre.
  update public.z_bills set status='aberta',cash_id=null where owner_id=u and cash_id=entry.id;

 elsif action='bill.save' then
  if p->>'id' is not null then
   select * into bill from public.z_bills where id=record_id and owner_id=u;
   if not found or bill.status<>'aberta' then raise exception 'Somente contas em aberto podem ser editadas.'; end if;
  end if;
  if coalesce(p->>'direction','') not in ('pagar','receber') or coalesce((p->>'amount')::bigint,0) <= 0 then raise exception 'Valor ou tipo inválido.'; end if;
  if nullif(p->>'contact_id','') is not null and not exists(select 1 from public.z_contacts where id=(p->>'contact_id')::uuid and owner_id=u) then raise exception 'Contato não encontrado.'; end if;
  insert into public.z_bills(id,owner_id,description,direction,amount,due_date,category,contact_id,notes)
  values(record_id,u,trim(p->>'description'),p->>'direction',(p->>'amount')::bigint,(p->>'due_date')::date,coalesce(p->>'category','Outros'),nullif(p->>'contact_id','')::uuid,coalesce(p->>'notes',''))
  on conflict(id) do update set description=excluded.description,direction=excluded.direction,amount=excluded.amount,due_date=excluded.due_date,category=excluded.category,contact_id=excluded.contact_id,notes=excluded.notes where z_bills.owner_id=u;

 elsif action='bill.pay' then
  select * into bill from public.z_bills where id=record_id and owner_id=u for update;
  if not found or bill.status<>'aberta' then raise exception 'Conta não está em aberto.'; end if;
  insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id)
  values(u,bill.description,case when bill.direction='pagar' then -bill.amount else bill.amount end,coalesce(nullif(p->>'date','')::date,business_date),bill.category,coalesce(p->>'payment','Pix'),'conta',bill.id)
  returning id into new_cash_id;
  update public.z_bills set status='paga',cash_id=new_cash_id where id=record_id and owner_id=u;

 elsif action='bill.cancel' then
  update public.z_bills set status='cancelada' where id=record_id and owner_id=u and status='aberta';
  if not found then raise exception 'Conta não está em aberto.'; end if;

 elsif action='settings.save' then
  insert into public.z_settings(owner_id,name,responsible,phone,email,document,address,monthly_goal,warranty_text)
  values(u,trim(p->>'name'),coalesce(p->>'responsible',''),coalesce(p->>'phone',''),coalesce(p->>'email',''),coalesce(p->>'document',''),coalesce(p->>'address',''),coalesce((p->>'monthly_goal')::bigint,0),coalesce(p->>'warranty_text',''))
  on conflict(owner_id) do update set name=excluded.name,responsible=excluded.responsible,phone=excluded.phone,email=excluded.email,document=excluded.document,address=excluded.address,monthly_goal=excluded.monthly_goal,warranty_text=excluded.warranty_text;
 else raise exception 'Operação desconhecida.';
 end if;
 result_value := jsonb_build_object('id',record_id,'ok',true);
 insert into zenith_private.requests(owner_id,request_id,body,result) values(u,command.request_id,jsonb_build_object('action',action,'payload',p),result_value);
 return result_value;
end $$;
revoke all on function zenith_private.command(uuid,text,jsonb) from public, anon;
grant execute on function zenith_private.command(uuid,text,jsonb) to authenticated;

-- Leitura consistente. Assinaturas (imagens) ficam fora do snapshot e são lidas sob demanda.
create or replace function public.z_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'contacts',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_contacts t),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(to_jsonb(t) order by t.code) from public.z_locations t),'[]'::jsonb),
 'boxes',coalesce((select jsonb_agg(to_jsonb(t) order by t.code) from public.z_boxes t),'[]'::jsonb),
 'scraps',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_scraps t),'[]'::jsonb),
 'parts',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_parts t),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg((to_jsonb(t) - 'signature')||jsonb_build_object('has_signature',t.signature<>'','items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.z_order_items i where i.order_id=t.id),'[]'::jsonb)) order by t.created_at desc,t.id) from public.z_orders t),'[]'::jsonb),
 'cash',coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc,t.created_at desc,t.id) from public.z_cash t),'[]'::jsonb),
 'bills',coalesce((select jsonb_agg(to_jsonb(t) order by t.due_date,t.id) from public.z_bills t),'[]'::jsonb),
 'moves',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_stock_moves t),'[]'::jsonb),
 'settings',coalesce((select to_jsonb(t) from public.z_settings t),'{"name":"Minha operação","responsible":"","phone":"","email":"","document":"","address":"","monthly_goal":0,"warranty_text":""}'::jsonb)
 );
$$;
revoke all on function public.z_snapshot() from public, anon;
grant execute on function public.z_snapshot() to authenticated;
commit;
