#!/bin/sh
# Removes all team-analytics live-test fixtures.
set -e

REF="jzkngsrnykozfcuifrsl"
BASE="https://$REF.supabase.co"
MGMT="https://api.supabase.com/v1/projects/$REF"
ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' web-cardr/.env | cut -d= -f2)

read A B C < tmp/ta-ids.txt
echo "deleting fixtures for A=$A B=$B C=$C"

SQL="delete from meeting_notes where user_id in ('$A','$B','$C');
delete from org_members where org_id = '11111111-2222-3333-4444-555555550001';
delete from organizations where id = '11111111-2222-3333-4444-555555550001';"
python3 - "$SQL" <<'PY' > tmp/ta-cleanup.json
import sys, json
print(json.dumps({"query": sys.argv[1]}))
PY
curl -sS -X POST "$MGMT/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @tmp/ta-cleanup.json
echo ""

KEYS=$(curl -sS "$MGMT/api-keys?reveal=true" -H "Authorization: Bearer $ACCESS_TOKEN")
SERVICE=$(printf '%s' "$KEYS" | python3 -c "import sys,json; ks=json.load(sys.stdin); print(next(k['api_key'] for k in ks if k['name']=='service_role'))")

for UID in "$A" "$B" "$C"; do
  curl -sS -o /dev/null -w "delete user $UID -> HTTP %{http_code}\n" \
    -X DELETE "$BASE/auth/v1/admin/users/$UID" \
    -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"
done
