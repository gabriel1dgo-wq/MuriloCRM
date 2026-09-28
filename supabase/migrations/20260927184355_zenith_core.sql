-- Independent schema: preserves every table from the previous application.
-- Money is represented as integer cents. No credentials or seed users.
begin;
create schema if not exists zenith_private;
revoke all on schema zenith_private from public, anon;
grant usage on schema zenith_private to authenticated;

create table public.z_contacts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 name text not null check(length(trim(name)) between 1 and 160), kind text not null check(kind in ('cliente','fornecedor','ambos')),
 phone text not null default '', email text not null default '', document text not null default '', notes text not null default '', archived boolean not null default false,
 unique(owner_id,id)
);
create table public.z_scraps (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 code text not null check(length(trim(code)) between 1 and 40), vehicle text not null check(length(trim(vehicle)) between 1 and 160), plate text not null default '',
 year integer not null check(year between 1900 and 2100), cost bigint not null check(cost between 0 and 10000000000), date date not null,
 status text not null check(status in ('aguardando','desmontando','finalizada')), notes text not null default '', unique(owner_id,code), unique(owner_id,id)
);
create table public.z_parts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 code text not null check(length(trim(code)) between 1 and 40), name text not null check(length(trim(name)) between 1 and 160), category text not null default '',
 scrap_id uuid, quantity integer not null default 0 check(quantity between 0 and 1000000), minimum integer not null default 0 check(minimum between 0 and 1000000),
 cost bigint not null check(cost between 0 and 10000000000), price bigint not null check(price between 0 and 10000000000), location text not null default '',
 condition text not null default 'Usada' check(condition in ('Nova','Usada','Recuperada')), archived boolean not null default false,
 unique(owner_id,code), unique(owner_id,id), foreign key(owner_id,scrap_id) references public.z_scraps(owner_id,id)
);
create table public.z_orders (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 kind text not null check(kind in ('venda','oficina')), contact_id uuid, customer text not null check(length(trim(customer)) between 1 and 160),
 channel text not null default 'balcao' check(channel in ('balcao','mercado_livre','shopee')), payment text not null check(payment in ('Pix','Dinheiro','Débito','Crédito','Boleto','Transferência')),
 vehicle text not null default '', plate text not null default '', description text not null default '', technician text not null default '', due_date date,
 status text not null check(status in ('confirmada','aberta','analise','aguardando_peca','execucao','finalizada','entregue','cancelada')),
 labor bigint not null default 0 check(labor between 0 and 10000000000), discount bigint not null default 0 check(discount between 0 and 10000000000), total bigint not null check(total between 0 and 10000000000),
 unique(owner_id,id), foreign key(owner_id,contact_id) references public.z_contacts(owner_id,id)
);
create table public.z_order_items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), order_id uuid not null, part_id uuid not null, scrap_id uuid,
 name text not null, quantity integer not null check(quantity between 1 and 1000000), price bigint not null check(price between 0 and 10000000000),
 foreign key(owner_id,scrap_id) references public.z_scraps(owner_id,id), unique(order_id,part_id), foreign key(owner_id,order_id) references public.z_orders(owner_id,id), foreign key(owner_id,part_id) references public.z_parts(owner_id,id)
);
create table public.z_cash (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 description text not null check(length(trim(description)) between 1 and 250), amount bigint not null check(amount between -10000000000 and 10000000000 and amount <> 0), date date not null,
 category text not null, payment text not null, source text not null check(source in ('manual','venda','oficina','sucata','estorno')), reference_id uuid, reversal_of uuid,
 unique(owner_id,id), unique(reversal_of), foreign key(owner_id,reversal_of) references public.z_cash(owner_id,id)
);
create table public.z_stock_moves (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 part_id uuid not null, delta integer not null check(delta <> 0), reason text not null check(length(trim(reason)) between 1 and 250), reference_id uuid,
 foreign key(owner_id,part_id) references public.z_parts(owner_id,id)
);
create table public.z_settings (
 owner_id uuid primary key references auth.users(id), name text not null check(length(trim(name)) between 1 and 160), responsible text not null default '',
 phone text not null default '', email text not null default '', document text not null default '', address text not null default ''
);
create table zenith_private.requests (
 owner_id uuid not null references auth.users(id), request_id uuid not null, body jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(owner_id,request_id)
);
alter table zenith_private.requests enable row level security;
revoke all on zenith_private.requests from public, anon, authenticated;

do $$ declare t text; begin
 foreach t in array array['z_contacts','z_scraps','z_parts','z_orders','z_order_items','z_cash','z_stock_moves','z_settings'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant select on public.%I to authenticated', t);
  execute format('create policy owner_read on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
  if t <> 'z_settings' then execute format('create index %I on public.%I(owner_id)', t || '_owner_idx', t); end if;
 end loop;
end $$;
create index z_orders_owner_created_idx on public.z_orders(owner_id,created_at desc);
create index z_cash_owner_date_idx on public.z_cash(owner_id,date desc);
create index z_items_order_idx on public.z_order_items(owner_id,order_id);
create index z_parts_scrap_idx on public.z_parts(owner_id,scrap_id);
create index z_moves_part_idx on public.z_stock_moves(owner_id,part_id,created_at desc);

-- Privileged writer is confined to an unexposed schema. Direct table writes are
-- forbidden, including for authenticated users. Every path checks auth.uid().
create function zenith_private.command(request_id uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); p jsonb := payload; record_id uuid; old_cost bigint := 0; amount_value bigint; total_value bigint := 0; labor_value bigint; discount_value bigint;
 part public.z_parts%rowtype; ord public.z_orders%rowtype; entry public.z_cash%rowtype; item jsonb; q integer; price_value bigint; result_value jsonb; existing zenith_private.requests%rowtype;
 new_status text; business_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if u is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
 if request_id is null or action is null or jsonb_typeof(p) is distinct from 'object' or length(p::text) > 200000 then raise exception 'Requisição inválida.'; end if;
 -- Serialize short mutations per account: prevents concurrent overselling and
 -- duplicate requests without exposing advisory locks to API clients.
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
 elsif action='scrap.save' then
  if p->>'id' is not null then select cost into old_cost from public.z_scraps where id=record_id and owner_id=u; if not found then raise exception 'Sucata não encontrada.'; end if; end if;
  insert into public.z_scraps(id,owner_id,code,vehicle,plate,year,cost,date,status,notes)
  values(record_id,u,trim(p->>'code'),trim(p->>'vehicle'),coalesce(p->>'plate',''),(p->>'year')::integer,(p->>'cost')::bigint,(p->>'date')::date,p->>'status',coalesce(p->>'notes',''))
  on conflict(id) do update set code=excluded.code,vehicle=excluded.vehicle,plate=excluded.plate,year=excluded.year,cost=excluded.cost,date=excluded.date,status=excluded.status,notes=excluded.notes where z_scraps.owner_id=u;
  amount_value := old_cost - (p->>'cost')::bigint;
  if amount_value <> 0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Aquisição '||(p->>'code'),amount_value,case when p->>'id' is null then (p->>'date')::date else business_date end,'Sucatas','Transferência','sucata',record_id); end if;
 elsif action='part.save' then
  if p->>'id' is not null then select * into part from public.z_parts where id=record_id and owner_id=u; if not found then raise exception 'Peça não encontrada.'; end if; end if;
  if coalesce((p->>'archived')::boolean,false) and exists(select 1 from public.z_order_items i join public.z_orders o on o.id=i.order_id where i.owner_id=u and i.part_id=record_id and o.kind='oficina' and o.status not in ('entregue','cancelada')) then raise exception 'A peça está reservada em uma OS em andamento.'; end if;
  insert into public.z_parts(id,owner_id,code,name,category,scrap_id,quantity,minimum,cost,price,location,condition,archived)
  values(record_id,u,trim(p->>'code'),trim(p->>'name'),coalesce(p->>'category',''),nullif(p->>'scrap_id','')::uuid,case when p->>'id' is null then (p->>'quantity')::integer else part.quantity end,(p->>'minimum')::integer,(p->>'cost')::bigint,(p->>'price')::bigint,coalesce(p->>'location',''),p->>'condition',coalesce((p->>'archived')::boolean,false))
  on conflict(id) do update set code=excluded.code,name=excluded.name,category=excluded.category,scrap_id=excluded.scrap_id,minimum=excluded.minimum,cost=excluded.cost,price=excluded.price,location=excluded.location,condition=excluded.condition,archived=excluded.archived where z_parts.owner_id=u;
  if p->>'id' is null and (p->>'quantity')::integer > 0 then insert into public.z_stock_moves(owner_id,part_id,delta,reason) values(u,record_id,(p->>'quantity')::integer,'Estoque inicial'); end if;
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
  labor_value := case when p->>'kind'='oficina' then (p->>'labor')::bigint else 0 end;
  discount_value := (p->>'discount')::bigint;
  total_value := labor_value-discount_value;
  for item in select value from jsonb_array_elements(p->'items') loop
   q := (item->>'quantity')::integer; price_value := (item->>'price')::bigint;
   if q is null or q<1 or q>1000000 or price_value is null or price_value<0 or price_value>10000000000 then raise exception 'Quantidade ou preço inválido.'; end if;
   total_value := total_value + q::bigint*price_value;
  end loop;
  insert into public.z_orders(id,owner_id,kind,contact_id,customer,channel,payment,vehicle,plate,description,technician,due_date,status,labor,discount,total)
  values(record_id,u,p->>'kind',nullif(p->>'contact_id','')::uuid,trim(p->>'customer'),p->>'channel',p->>'payment',coalesce(p->>'vehicle',''),coalesce(p->>'plate',''),coalesce(p->>'description',''),coalesce(p->>'technician',''),nullif(p->>'due_date','')::date,case when action='order.update' then ord.status when p->>'kind'='venda' then 'confirmada' else 'aberta' end,labor_value,discount_value,total_value)
  on conflict(id) do update set contact_id=excluded.contact_id,customer=excluded.customer,payment=excluded.payment,vehicle=excluded.vehicle,plate=excluded.plate,description=excluded.description,technician=excluded.technician,due_date=excluded.due_date,labor=excluded.labor,discount=excluded.discount,total=excluded.total where z_orders.owner_id=u;
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
    if new_status='entregue' and ord.total>0 then insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reference_id) values(u,'Oficina · '||ord.customer,ord.total,business_date,'Oficina',ord.payment,'oficina',record_id); end if;
   end if;
   update public.z_orders set status=new_status where id=record_id and owner_id=u;
  end if;
 elsif action='cash.create' then
  if coalesce(p->>'direction','') not in ('entrada','saida') or (p->>'amount')::bigint <= 0 then raise exception 'Valor ou tipo inválido.'; end if;
  amount_value := (p->>'amount')::bigint * case when p->>'direction'='saida' then -1 else 1 end;
  insert into public.z_cash(id,owner_id,description,amount,date,category,payment,source) values(record_id,u,trim(p->>'description'),amount_value,(p->>'date')::date,p->>'category',p->>'payment','manual');
 elsif action='cash.reverse' then
  select * into entry from public.z_cash where id=record_id and owner_id=u and source='manual';
  if not found then raise exception 'Lançamento manual não encontrado.'; end if;
  insert into public.z_cash(owner_id,description,amount,date,category,payment,source,reversal_of) values(u,'Estorno · '||entry.description,-entry.amount,business_date,entry.category,entry.payment,'estorno',entry.id);
 elsif action='settings.save' then
  insert into public.z_settings(owner_id,name,responsible,phone,email,document,address) values(u,trim(p->>'name'),coalesce(p->>'responsible',''),coalesce(p->>'phone',''),coalesce(p->>'email',''),coalesce(p->>'document',''),coalesce(p->>'address',''))
  on conflict(owner_id) do update set name=excluded.name,responsible=excluded.responsible,phone=excluded.phone,email=excluded.email,document=excluded.document,address=excluded.address;
 else raise exception 'Operação desconhecida.';
 end if;
 result_value := jsonb_build_object('id',record_id,'ok',true);
 insert into zenith_private.requests(owner_id,request_id,body,result) values(u,command.request_id,jsonb_build_object('action',action,'payload',p),result_value);
 return result_value;
end $$;
revoke all on function zenith_private.command(uuid,text,jsonb) from public, anon;
grant execute on function zenith_private.command(uuid,text,jsonb) to authenticated;

create function public.z_command(request_id uuid, action text, payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select zenith_private.command(request_id,action,payload); $$;
revoke all on function public.z_command(uuid,text,jsonb) from public, anon;
grant execute on function public.z_command(uuid,text,jsonb) to authenticated;

-- One statement provides a consistent read across all modules. RLS applies.
create function public.z_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'contacts',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_contacts t),'[]'::jsonb),
 'scraps',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_scraps t),'[]'::jsonb),
 'parts',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_parts t),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.z_order_items i where i.order_id=t.id),'[]'::jsonb)) order by t.created_at desc,t.id) from public.z_orders t),'[]'::jsonb),
 'cash',coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc,t.created_at desc,t.id) from public.z_cash t),'[]'::jsonb),
 'moves',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from public.z_stock_moves t),'[]'::jsonb),
 'settings',coalesce((select to_jsonb(t) from public.z_settings t),'{"name":"Minha operação","responsible":"","phone":"","email":"","document":"","address":""}'::jsonb)
 );
$$;
revoke all on function public.z_snapshot() from public, anon;
grant execute on function public.z_snapshot() to authenticated;
commit;
