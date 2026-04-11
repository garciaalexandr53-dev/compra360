-- Drop the INSERT and UPDATE policies that allow users to self-manage subscriptions
DROP POLICY IF EXISTS "Users insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;