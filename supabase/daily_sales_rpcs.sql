-- increment_daily_sales: called on order close
-- Upserts a daily_sales row and adds revenue/collection amounts atomically.
create or replace function increment_daily_sales(
  p_date             date,
  p_entered_by       uuid,
  p_cocktails_revenue numeric default 0,
  p_beer_revenue      numeric default 0,
  p_wine_revenue      numeric default 0,
  p_food_revenue      numeric default 0,
  p_others_revenue    numeric default 0,
  p_cash_collected    numeric default 0,
  p_credit_card_collected numeric default 0,
  p_qr_collected      numeric default 0,
  p_online_collected  numeric default 0,
  p_transaction_count int    default 1
) returns void language plpgsql security definer as $$
begin
  insert into daily_sales (
    date, entered_by,
    cocktails_revenue, beer_revenue, wine_revenue, food_revenue, others_revenue,
    cash_collected, credit_card_collected, qr_collected, online_collected,
    transaction_count
  ) values (
    p_date, p_entered_by,
    p_cocktails_revenue, p_beer_revenue, p_wine_revenue, p_food_revenue, p_others_revenue,
    p_cash_collected, p_credit_card_collected, p_qr_collected, p_online_collected,
    p_transaction_count
  )
  on conflict (date) do update set
    cocktails_revenue       = daily_sales.cocktails_revenue       + excluded.cocktails_revenue,
    beer_revenue            = daily_sales.beer_revenue            + excluded.beer_revenue,
    wine_revenue            = daily_sales.wine_revenue            + excluded.wine_revenue,
    food_revenue            = daily_sales.food_revenue            + excluded.food_revenue,
    others_revenue          = daily_sales.others_revenue          + excluded.others_revenue,
    cash_collected          = daily_sales.cash_collected          + excluded.cash_collected,
    credit_card_collected   = daily_sales.credit_card_collected   + excluded.credit_card_collected,
    qr_collected            = daily_sales.qr_collected            + excluded.qr_collected,
    online_collected        = daily_sales.online_collected        + excluded.online_collected,
    transaction_count       = daily_sales.transaction_count       + excluded.transaction_count;
end;
$$;

-- decrement_daily_sales: called on order reopen (reverses the increment)
-- Subtracts revenue/collection amounts. Clamps to 0 to avoid negative totals.
create or replace function decrement_daily_sales(
  p_date             date,
  p_cocktails_revenue numeric default 0,
  p_beer_revenue      numeric default 0,
  p_wine_revenue      numeric default 0,
  p_food_revenue      numeric default 0,
  p_others_revenue    numeric default 0,
  p_cash_collected    numeric default 0,
  p_credit_card_collected numeric default 0,
  p_qr_collected      numeric default 0,
  p_online_collected  numeric default 0,
  p_transaction_count int    default 1
) returns void language plpgsql security definer as $$
begin
  update daily_sales set
    cocktails_revenue       = greatest(0, cocktails_revenue       - p_cocktails_revenue),
    beer_revenue            = greatest(0, beer_revenue            - p_beer_revenue),
    wine_revenue            = greatest(0, wine_revenue            - p_wine_revenue),
    food_revenue            = greatest(0, food_revenue            - p_food_revenue),
    others_revenue          = greatest(0, others_revenue          - p_others_revenue),
    cash_collected          = greatest(0, cash_collected          - p_cash_collected),
    credit_card_collected   = greatest(0, credit_card_collected   - p_credit_card_collected),
    qr_collected            = greatest(0, qr_collected            - p_qr_collected),
    online_collected        = greatest(0, online_collected        - p_online_collected),
    transaction_count       = greatest(0, transaction_count       - p_transaction_count)
  where date = p_date;
end;
$$;
