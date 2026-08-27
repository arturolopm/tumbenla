# Fuentes de esta carpeta

Las dos vienen de Google Fonts bajo la **SIL Open Font License 1.1**, que
permite usarlas, incrustarlas y redistribuirlas. Estan versionadas en el repo, y
no bajadas durante el build, para que compilar no dependa de que
`fonts.gstatic.com` conteste.

- `anybody-black.ttf` — Anybody, peso 900. Copyright The Anybody Project Authors
  (https://github.com/Etcetera-Type-Co/Anybody)
- `montserrat-semibold.ttf` — Montserrat, peso 600. Copyright The Montserrat
  Project Authors (https://github.com/JulietaUla/Montserrat)

Son las mismas dos familias que carga `src/app/layout.tsx` por `next/font`. Si
alli cambia la tipografia, estos archivos hay que cambiarlos tambien: Satori no
puede leer lo que `next/font` descarga.
