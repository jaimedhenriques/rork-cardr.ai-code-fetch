#!/bin/sh
# Live test for the team-analytics edge function.
set -e

REF="jzkngsrnykozfcuifrsl"
BASE="https://$REF.supabase.co"
MGMT="https://api.supabase.com/v1/projects/$REF"
ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' web-cardr/.env | cut -d= -f2)

# 1. Reveal API keys
KEYS=$(curl -sS "$MGMT/api-keys?reveal=true" -H "Authorization: Bearer $ACCESS_TOKEN")
ANON=$(printf '%s' "$KEYS" | python3 -c "import sys,json; ks=json.load(sys.stdin); print(next(k['api_key'] for k in ks if k['name']=='anon'))")
SERVICE=$(printf '%s' "$KEYS" | python3 -c "import sys,json; ks=json.load(sys.stdin); print(next(k['api_key'] for k in ks if k['name']=='service_role'))")

mkuser() {
  curl -sS -X POST "$BASE/auth/v1/admin/users" \
    -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"TeamTest!2026\",\"email_confirm\":true}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
}

A=$(mkuser "ta-owner@cardr-test.dev")
B=$(mkuser "ta-mate@cardr-test.dev")
C=$(mkuser "ta-loner@cardr-test.dev")
echo "users: A=$A B=$B C=$C"
printf '%s %s %s\n' "$A" "$B" "$C" > tmp/ta-ids.txt

# 2. Fixtures via SQL
SQL=$(cat <<EOF
insert into organizations (id, name, slug) values ('11111111-2222-3333-4444-555555550001', 'TA Test Org', 'ta-test-org');
insert into org_members (org_id, user_id, role) values
  ('11111111-2222-3333-4444-555555550001', '$A', 'owner'),
  ('11111111-2222-3333-4444-555555550001', '$B', 'member');
update profiles set name = 'Alice Owner' where id = '$A';
update profiles set name = 'Bob Mate' where id = '$B';
insert into meeting_notes (user_id, title, duration_seconds, created_at, analytics, action_items) values
  ('$A', 'Kickoff with ACME', 1800, now() - interval '2 days',
   '{"questionsAsked": 6, "sentimentScore": 0.8, "engagementLevel": "high", "talkTimeRatio": {"Alice": 0.55, "Client": 0.45}}'::jsonb,
   '[{"task": "Send proposal to ACME", "owner": "Alice", "priority": "high", "done": false}, {"task": "Book demo", "owner": "Alice", "done": true}]'::jsonb),
  ('$A', 'Weekly standup', 900, now() - interval '1 day',
   '{"questionsAsked": 2, "sentimentScore": 0.6, "engagementLevel": "medium", "talkTimeRatio": {"Alice": 0.7, "Bob": 0.3}}'::jsonb,
   '[]'::jsonb),
  ('$B', 'Discovery call', 2400, now() - interval '3 days',
   '{"questionsAsked": 9, "sentimentScore": 0.4, "engagementLevel": "high", "talkTimeRatio": {"Bob": 0.35, "Prospect": 0.65}}'::jsonb,
   '[{"task": "Follow up on pricing", "owner": "Bob", "priority": "medium", "done": false}]'::jsonb),
  ('$B', 'Old meeting outside range', 600, now() - interval '90 days',
   '{"questionsAsked": 1, "sentimentScore": 0.9, "engagementLevel": "low"}'::jsonb,
   '[{"task": "Ancient task", "done": false}]'::jsonb);
EOF
)
python3 - "$SQL" <<'PY' > tmp/ta-sql.json
import sys, json
print(json.dumps({"query": sys.argv[1]}))
PY
curl -sS -X POST "$MGMT/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @tmp/ta-sql.json
echo ""

signin() {
  curl -sS -X POST "$BASE/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"TeamTest!2026\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}

TOK_A=$(signin "ta-owner@cardr-test.dev")
TOK_C=$(signin "ta-loner@cardr-test.dev")

echo "=== member, 30d ==="
curl -sS -X POST "$BASE/functions/v1/team-analytics" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" -H "Content-Type: application/json" \
  -d '{"rangeDays": 30}' | python3 -m json.tool

echo "=== member, all time (should include the 90-day-old note) ==="
curl -sS -X POST "$BASE/functions/v1/team-analytics" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" -H "Content-Type: application/json" \
  -d '{"rangeDays": 9999}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('meetings:', d['totals']['meetings'], 'actionItems:', d['totals']['actionItemsTotal'])"

echo "=== non-org user (expect 403 NOT_IN_ORG) ==="
curl -sS -w "\nHTTP %{http_code}\n" -X POST "$BASE/functions/v1/team-analytics" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_C" -H "Content-Type: application/json" \
  -d '{"rangeDays": 30}'

echo "=== no auth (expect 401) ==="
curl -sS -w "\nHTTP %{http_code}\n" -X POST "$BASE/functions/v1/team-analytics" \
  -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
