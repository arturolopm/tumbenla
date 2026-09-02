-- `NOT NULL` sin default sobre una tabla que ya existe normalmente NO se puede
-- (`PRODUCT.md`: toda migracion es aditiva, columnas nullable al agregar). Aca
-- si, y por una razon concreta: `product_order` la crea la migracion 0010,
-- inmediatamente anterior, que todavia no ha llegado a ningun ambiente. La
-- tabla esta vacia en todas partes, asi que no hay fila que quedarse sin valor.
--
-- Si alguna vez 0010 llega a produccion sin esta, esta deja de poder aplicarse
-- y hay que partirla en tres pasos: agregar nullable, rellenar, y exigir.
ALTER TABLE "product_order" ADD COLUMN "public_token" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_order_publicToken_key" ON "product_order" USING btree ("public_token");