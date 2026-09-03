-- Retirar el compromiso general (decision 34) y bajar el alta a cuatro campos
-- sin cuenta por delante (decision 35).
--
-- TODO ACA ES ADITIVO, Y NO ES UN DESCUIDO QUE FALTEN LOS DROP.
-- vercel.json corre `bun run migrate && bun run build`: el esquema nuevo esta
-- vivo unos segundos ANTES que el codigo nuevo, y `db.select()` de Drizzle
-- nombra cada columna en vez de emitir `select *`. Borrar aqui las nueve
-- columnas pledge_* haria que la version que todavia esta sirviendo /sitios
-- pidiera venue.pledge_type y reventara. Las columnas quedan muertas en su
-- sitio y se borran en el deploy SIGUIENTE. Misma regla que
-- order_redemption.code_hash, y esta escrita en PRODUCT.md, "Migraciones".
--
-- Por lo mismo pledge_currency NO se renombra a currency: un rename es un drop
-- mas un add y rompe la misma ventana. Nunca lo escribio nadie y
-- getHistorySummary ya caia a 'COP', asi que el codigo pasa a una constante y
-- la columna se muere con las demas.
--
-- venue_application: user_id se afloja porque la solicitud ahora nace sin
-- dueno; type, city y address_line porque el formulario de cuatro campos ya no
-- los pide. public_token entra NULLABLE a la fuerza: las filas viejas no lo
-- tienen y un NOT NULL fallaria. Su unique deja pasar varios NULL, que es justo
-- lo que hace falta.
--
-- OJO CON venue_application_email_vivas_key: es UNIQUE sobre filas que ya
-- existen. Si en el ambiente hay dos solicitudes vivas con el mismo correo de
-- contacto, esta migracion FALLA. Verificado vacio en local; revisar en preview
-- antes de subir a produccion con:
--   select lower(contact_email), count(*) from venue_application
--    where status in ('pending','verifying') group by 1 having count(*) > 1;

ALTER TABLE "venue" ALTER COLUMN "pledge_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_application" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_application" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_application" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_application" ALTER COLUMN "address_line" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_application" ADD COLUMN "public_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_application_email_vivas_key" ON "venue_application" USING btree (lower("contact_email")) WHERE "venue_application"."status" in ('pending', 'verifying');--> statement-breakpoint
CREATE UNIQUE INDEX "venue_application_publicToken_key" ON "venue_application" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "venue_application_contactEmail_idx" ON "venue_application" USING btree (lower("contact_email")) WHERE "venue_application"."user_id" is null;