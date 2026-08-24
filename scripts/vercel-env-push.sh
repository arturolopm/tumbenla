#!/usr/bin/env bash
#
# Sube a Vercel las variables de un archivo .env, para un ambito concreto.
#
#   scripts/vercel-env-push.sh .env.vercel.preview preview
#   scripts/vercel-env-push.sh .env.vercel.prod    production --dry-run
#
# Por que existe: `vercel env add` va de una en una y toma el valor por prompt,
# que no sirve sin TTY. Pasar el valor con --value lo deja en el historial del
# shell, y estas cadenas llevan contrasenas. Aca cada valor viaja por STDIN, asi
# que nunca aparece en la linea de comandos ni se imprime.
#
# Es idempotente: --force sobrescribe si la variable ya existe, asi que se puede
# volver a correr despues de rotar credenciales.
set -euo pipefail

archivo="${1:-}"
entorno="${2:-}"
simulacro="${3:-}"

if [[ -z "$archivo" || -z "$entorno" ]]; then
  echo "uso: $0 <archivo.env> <production|preview|development> [--dry-run]" >&2
  exit 1
fi
[[ -f "$archivo" ]] || { echo "no existe: $archivo" >&2; exit 1; }
case "$entorno" in
  production|preview|development) ;;
  *) echo "ambito invalido: $entorno (production|preview|development)" >&2; exit 1 ;;
esac

subidas=0 saltadas=0 fallidas=0

while IFS= read -r linea || [[ -n "$linea" ]]; do
  linea="${linea#"${linea%%[![:space:]]*}"}"          # quita espacios a la izquierda
  [[ -z "$linea" || "$linea" == \#* || "$linea" != *=* ]] && continue

  clave="${linea%%=*}"
  valor="${linea#*=}"
  clave="${clave%"${clave##*[![:space:]]}"}"          # quita espacios a la derecha
  valor="${valor%"${valor##*[![:space:]]}"}"

  # quita un par de comillas envolventes, si las hay
  if [[ "$valor" == \"*\" || "$valor" == \'*\' ]]; then
    valor="${valor:1:${#valor}-2}"
  fi

  # los huecos sin rellenar del archivo plantilla no se suben
  if [[ -z "$valor" || "$valor" == "<<<"* ]]; then
    printf '  saltada  %-32s (%s)\n' "$clave" "${valor:+sin rellenar}${valor:-vacia}"
    saltadas=$((saltadas + 1))
    continue
  fi

  if [[ "$simulacro" == "--dry-run" ]]; then
    printf '  subiria  %-32s (%d chars)\n' "$clave" "${#valor}"
    subidas=$((subidas + 1))
    continue
  fi

  if printf '%s' "$valor" | vercel env add "$clave" "$entorno" --force --yes >/dev/null 2>&1; then
    printf '  ok       %-32s\n' "$clave"
    subidas=$((subidas + 1))
  else
    printf '  FALLO    %-32s\n' "$clave"
    fallidas=$((fallidas + 1))
  fi
done < "$archivo"

echo
echo "ambito $entorno: $subidas subidas, $saltadas saltadas, $fallidas fallidas"
[[ "$fallidas" -eq 0 ]]
