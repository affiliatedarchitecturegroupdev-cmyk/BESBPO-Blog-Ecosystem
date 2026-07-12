#!/usr/bin/env bash
# Scaffolds a new subsidiary site from besbpo-subsidiary-site-template,
# substituting real company details in place of the template's
# placeholders. Reduces the Phase 4 pilot wave's manual copy-paste-and-
# edit process to one command for the Phase 8 full rollout — see
# ../FULL-ROLLOUT.md for why this script exists but does NOT itself
# decide what the remaining 25+ subsidiaries are; it only automates
# turning a real name into a real site once you have one.
#
# Usage:
#   ./scaffold-subsidiary-site.sh <slug> "<Company Name>" <division1,division2,...> [placement]
#
# Example:
#   ./scaffold-subsidiary-site.sh acme-logistics "Acme Logistics (Pty) Ltd" logistics timeline
#
# placement defaults to "timeline" if omitted (one of: timeline,
# sidebar_widget, body_embed — see PILOT-WAVE.md for why the 5 pilots
# deliberately varied this rather than defaulting every site to the same
# placement).
#
# Does NOT set tenant_id (that's issued by onboard-pilot-tenants.sh
# against a live syndication service — see this script's own output for
# the reminder) and does NOT create the GitHub remote — this only
# generates the local directory and commits it, matching how the 5 Phase
# 4 pilots were built.
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <slug> \"<Company Name>\" <division1,division2,...> [placement]" >&2
  exit 1
fi

SLUG="$1"
NAME="$2"
DIVISIONS_CSV="$3"
PLACEMENT="${4:-timeline}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_DIR="$PLATFORM_ROOT/besbpo-subsidiary-site-template"
TARGET_DIR="$PLATFORM_ROOT/besbpo-subsidiary-site-$SLUG"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: template not found at $TEMPLATE_DIR" >&2
  exit 1
fi
if [[ -d "$TARGET_DIR" ]]; then
  echo "ERROR: $TARGET_DIR already exists — refusing to overwrite" >&2
  exit 1
fi
if [[ ! "$PLACEMENT" =~ ^(timeline|sidebar_widget|body_embed)$ ]]; then
  echo "ERROR: placement must be one of timeline, sidebar_widget, body_embed (got: $PLACEMENT)" >&2
  exit 1
fi

# division_tags as a JSON array, built from the comma-separated input —
# python3 for correct JSON string escaping rather than hand-built quoting.
DIVISIONS_JSON=$(python3 -c "
import json, sys
divisions = [d.strip() for d in sys.argv[1].split(',') if d.strip()]
print(json.dumps(divisions))
" "$DIVISIONS_CSV")

echo "Scaffolding $TARGET_DIR from template..."
cp -r "$TEMPLATE_DIR" "$TARGET_DIR"
rm -rf "$TARGET_DIR/.git"

# Substitute in index.html
python3 -c "
path = '$TARGET_DIR/index.html'
with open(path) as f:
    content = f.read()
content = content.replace('[Subsidiary Name]', '''$NAME''')
content = content.replace('data-mode=\"timeline\"', 'data-mode=\"$PLACEMENT\"')
with open(path, 'w') as f:
    f.write(content)
"

# Substitute in config.json (tenant_id deliberately left as the
# placeholder — see the header comment above)
python3 -c "
import json
path = '$TARGET_DIR/config.json'
with open(path) as f:
    config = json.load(f)
config['division_tags'] = json.loads('''$DIVISIONS_JSON''')
config['display_mode'] = '$PLACEMENT'
config['brand_name'] = '''$NAME'''
config['_onboarding_note'] = (
    'tenant_id and the widget\\'s data-tenant-id in index.html are placeholders '
    'until scripts/onboard-pilot-tenants.sh (besbpo-blog-architecture) is run '
    'against a live besbpo-blog-syndication-svc instance — see FULL-ROLLOUT.md.'
)
with open(path, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
"

cd "$TARGET_DIR"
git init -q -b main
git add -A
git commit -q -m "Scaffold $NAME's subsidiary site from besbpo-subsidiary-site-template

Divisions: $DIVISIONS_JSON
Placement: $PLACEMENT

Onboarding pending — see besbpo-blog-architecture/FULL-ROLLOUT.md and
scripts/onboard-pilot-tenants.sh. tenant_id/api_key placeholders will be
replaced once onboarded against a live besbpo-blog-syndication-svc
instance."

echo ""
echo "Created $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  1. Review/customize assets/style.css for $NAME's actual brand (colors, fonts)."
echo "  2. Add a real entry for '$NAME' to a full-rollout-tenants.json manifest"
echo "     (see scripts/full-rollout-tenants.template.json for the shape)."
echo "  3. Run: ADMIN_JWT=<token> ./onboard-pilot-tenants.sh --file full-rollout-tenants.json"
echo "  4. Copy the returned tenant_id/api_key into $TARGET_DIR/config.json and index.html."
echo "  5. Create the GitHub repo, push, enable GitHub Pages."
