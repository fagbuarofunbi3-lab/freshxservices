DROP POLICY IF EXISTS "Deny all direct client access" ON public.service_items;
CREATE POLICY "Deny all direct client access"
ON public.service_items
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);