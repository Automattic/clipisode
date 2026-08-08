#!/usr/bin/env bash
# Renders every invitation-flow path to a directory, for before/after diffing.
#
#   tools/render-harness/render-all.sh /tmp/before
#   ...make a change...
#   tools/render-harness/render-all.sh /tmp/after
#   diff -rq /tmp/before /tmp/after
#
# Set WPROOT if your Studio site lives elsewhere. The Studio app does NOT need
# to be running.
set -euo pipefail

OUTDIR="${1:?usage: render-all.sh <output-dir>}"
WPROOT="${WPROOT:-$HOME/Studio/alvey-clipisode}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TPL="$REPO/plugin/clipisode/assets/templates/clipisode-flow.php"
HARNESS="$REPO/tools/render-harness/render.php"

# Full UA strings on purpose: wp_is_mobile() looks for the "Mobile/" token, so an
# abbreviated iPhone UA would silently test the desktop branch twice.
MOBILE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
DESKTOP='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Pick an open invitation link straight from the database.
SLUG="${SLUG:-$(WPROOT="$WPROOT" php -d error_reporting=E_ERROR -r '
define("DB_NAME","wordpress"); define("DB_USER","root"); define("DB_PASSWORD","");
define("DB_HOST","localhost"); define("DB_CHARSET","utf8"); define("DB_COLLATE","");
$_SERVER["HTTP_HOST"]="localhost"; $_SERVER["REQUEST_URI"]="/"; $_SERVER["REQUEST_METHOD"]="GET";
require getenv("WPROOT")."/wp-load.php";
global $wpdb;
echo (string) $wpdb->get_var("SELECT slug FROM {$wpdb->prefix}clipisode_invitation_links WHERE status = '"'"'open'"'"' LIMIT 1");
' 2>/dev/null)}"

if [ -z "$SLUG" ]; then
  echo "No open invitation link found in $WPROOT — create one in WP Admin first." >&2
  exit 1
fi

mkdir -p "$OUTDIR"
echo "slug=$SLUG  ->  $OUTDIR"

render() { # name screen ua
  WPROOT="$WPROOT" TPL="$TPL" SLUG="$SLUG" SCREEN="$2" UA="$3" OUT="$OUTDIR/$1.html" \
    php -d error_reporting=E_ERROR "$HARNESS"
}

render mobile-intro   ""              "$MOBILE"
render desktop-intro  ""              "$DESKTOP"
render name           "name"          "$MOBILE"
render email          "email"         "$MOBILE"
render success        "success"        "$MOBILE"
render closed         "closed"        "$MOBILE"
render warning-camera  "warning_camera"  "$MOBILE"
render warning-network "warning_network" "$MOBILE"
render warning-silent  "warning_silent"  "$MOBILE"
render warning-wide    "warning_wide"    "$MOBILE"
