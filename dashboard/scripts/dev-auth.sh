#!/usr/bin/env bash
# dev-auth.sh — start the Vite dev server with the MRHSession cookie
# fetched securely from the system keyring (GNOME Keyring / libsecret).
#
# First-time setup — store your cookie:
#   ./scripts/dev-auth.sh --store
#
# Faster: copy cookie to clipboard with the bookmarklet, then:
#   ./scripts/dev-auth.sh --from-clipboard
#
# Normal usage — start dev server with the stored cookie:
#   ./scripts/dev-auth.sh
#   (or: npm run dev:auth)

SERVICE="simdb-dashboard"
ACCOUNT="MRHSession"

read_clipboard() {
  if command -v xclip &>/dev/null; then
    xclip -selection clipboard -o 2>/dev/null
  elif command -v xsel &>/dev/null; then
    xsel --clipboard --output 2>/dev/null
  else
    echo ""
  fi
}

store_cookie() {
  local cookie_value="$1"
  if [[ -z "$cookie_value" ]]; then
    echo "Open https://simdb.iter.org in your browser, log in, then:"
    echo "  DevTools (F12) → Application → Cookies → simdb.iter.org → MRHSession value"
    echo ""
    read -rp "Paste the MRHSession cookie value: " cookie_value
  fi
  if [[ -z "$cookie_value" ]]; then
    echo "Error: no value entered." >&2
    exit 1
  fi
  echo -n "$cookie_value" | secret-tool store \
    --label="ITER SimDB MRHSession cookie" \
    service "$SERVICE" \
    account "$ACCOUNT"
  echo "Stored. Run 'npm run dev:auth' to start the dev server."
}

from_clipboard() {
  if ! command -v xclip &>/dev/null && ! command -v xsel &>/dev/null; then
    echo "Error: install xclip first:  sudo apt install xclip" >&2
    exit 1
  fi
  local cookie_value
  cookie_value=$(read_clipboard)
  if [[ -z "$cookie_value" ]]; then
    echo "Error: clipboard is empty." >&2
    exit 1
  fi
  store_cookie "$cookie_value"
}

start_dev() {
  cookie=$(secret-tool lookup service "$SERVICE" account "$ACCOUNT" 2>/dev/null)
  if [[ -z "$cookie" ]]; then
    echo "No cookie found in keyring. Run first:"
    echo "  ./scripts/dev-auth.sh --store"
    exit 1
  fi
  echo "Using MRHSession from keyring."
  exec env VITE_MRH_SESSION="$cookie" npm run dev
}

case "${1:-}" in
  --store|-s)          store_cookie "" ;;
  --from-clipboard|-c) from_clipboard  ;;
  *)                   start_dev       ;;
esac
