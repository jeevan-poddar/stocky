-- Create Bills Table
create table if not exists bills (
  id uuid default uuid_generate_v4() primary key,
  customer_name text not null,
  customer_phone text,
  doctor_name text,
  total_amount numeric not null,
  total_profit numeric not null,
  payment_mode text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- Create Bill Items Table
create table if not exists bill_items (
  id uuid default uuid_generate_v4() primary key,
  bill_id uuid references bills(id) on delete cascade,
  medicine_id uuid references medicines(id),
  medicine_name text not null,
  batch_no text,
  expiry_date date,
  quantity numeric not null,
  mrp numeric not null,
  selling_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Transaction RPC Function
create or replace function create_bill_transaction(
  p_customer_name text,
  p_customer_phone text,
  p_doctor_name text,
  p_total_amount numeric,
  p_total_profit numeric,
  p_payment_mode text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_bill_id uuid;
  v_item jsonb;
  v_med_id uuid;
  v_qty numeric;
  v_current_stock_loose numeric;
  v_current_stock_packets numeric;
  v_units_per_packet numeric;
  v_total_stock numeric;
  v_new_total_stock numeric;
  v_new_packets numeric;
  v_new_loose numeric;
begin
  -- 1. Insert Bill Header
  insert into bills (
    customer_name, customer_phone, doctor_name, 
    total_amount, total_profit, payment_mode, user_id
  ) values (
    p_customer_name, p_customer_phone, p_doctor_name, 
    p_total_amount, p_total_profit, p_payment_mode, auth.uid()
  ) returning id into v_bill_id;

  -- 2. Process Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_med_id := (v_item->>'id')::uuid;
    v_qty := (v_item->>'cartQuantity')::numeric;

    -- Insert Bill Item
    insert into bill_items (
      bill_id, medicine_id, medicine_name, batch_no, expiry_date, 
      quantity, mrp, selling_price
    ) values (
      v_bill_id, 
      v_med_id,
      v_item->>'name',
      v_item->>'batch_no',
      (v_item->>'expiry_date')::date,
      v_qty,
      (v_item->>'mrp')::numeric,
      (v_item->>'sellingPrice')::numeric
    );

    -- 3. Update Inventory Stock
    -- Get current stock details
    select stock_loose, stock_packets, units_per_packet 
    into v_current_stock_loose, v_current_stock_packets, v_units_per_packet
    from medicines where id = v_med_id;

    -- Calculate total loose units available
    v_total_stock := (v_current_stock_packets * v_units_per_packet) + v_current_stock_loose;
    
    -- Calculate new total stock
    v_new_total_stock := v_total_stock - v_qty;

    if v_new_total_stock < 0 then
      raise exception 'Insufficient stock for medicine %', (v_item->>'name');
    end if;

    -- Convert back to packets + loose
    -- floor(total / units) = packets
    -- total % units = loose
    v_new_packets := floor(v_new_total_stock / v_units_per_packet);
    v_new_loose := v_new_total_stock % v_units_per_packet;

    -- Update medicine record
    update medicines 
    set stock_packets = v_new_packets,
        stock_loose = v_new_loose
    where id = v_med_id;
    
  end loop;

  return v_bill_id;
end;
$$;
