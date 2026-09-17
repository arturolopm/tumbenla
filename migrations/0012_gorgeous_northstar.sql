-- Correccion de diseno, no una funcion nueva.
--
-- El codigo del QR se guardaba HASHEADO, copiando venue_invitation.tokenHash.
-- Estaba mal aca por una razon operativa: el comprador tiene que poder LEER su
-- codigo de la pantalla y el mesero tiene que poder TECLEARLO cuando la camara
-- no enfoca —bar oscuro, pantalla rayada, lente sucio, permiso negado—. Un hash
-- no se puede mostrar, asi que hashearlo eliminaba en silencio el respaldo del
-- que depende todo el escaner.
--
-- Los dos casos no se parecen: una invitacion da acceso al panel de un sitio,
-- esto es un vale por un trago en un bar, redimible solo por un endpoint que ya
-- exige sesion de personal de ESE sitio.
--
-- `code_hash` se deja NULLABLE en vez de borrarse: quitar una columna tiene que
-- ser su propio deploy (`PRODUCT.md`, "Migraciones"), porque el esquema nuevo
-- esta vivo unos segundos antes que el codigo nuevo. Se borra en una posterior.
--
-- El `NOT NULL` de `code` se puede porque `order_redemption` la crea la 0010,
-- que todavia no ha llegado a ningun ambiente: la tabla esta vacia en todas
-- partes.
DROP INDEX "order_redemption_codeHash_key";--> statement-breakpoint
ALTER TABLE "order_redemption" ALTER COLUMN "code_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_redemption" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "order_redemption_code_key" ON "order_redemption" USING btree ("code");--> statement-breakpoint
CREATE INDEX "order_redemption_codeHash_idx" ON "order_redemption" USING btree ("code_hash");