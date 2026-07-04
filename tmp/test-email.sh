#!/bin/sh
# Live tests for the email stack (Resend SMTP + 4 edge functions).
set -u
SB="https://jzkngsrnykozfcuifrsl.supabase.co"
PUB="sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh"
SEC="sb_secret_Te0NXU8bwdb7xcAENokCqQ_N5jQvCQD"
FN="$SB/functions/v1"
TESTMAIL="delivered@resend.dev"

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d)[:400])"; }

echo "== test user =="
U=$(curl -s -X POST "$SB/auth/v1/admin/users" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -d '{"email":"email-test@cardr-test.dev","password":"Test-Pass-123!","email_confirm":true}')
UID1=$(echo "$U" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id') or d.get('msg') or '')")
if [ -z "$UID1" ] || [ "${#UID1}" -ne 36 ]; then
  UID1=$(curl -s "$SB/rest/v1/profiles?email=eq.email-test@cardr-test.dev&select=id" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" | python3 -c "import json,sys;r=json.load(sys.stdin);print(r[0]['id'] if r else '')")
fi
echo "user=$UID1"
T=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"email-test@cardr-test.dev","password":"Test-Pass-123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('access_token',''))")
echo "token: ${#T} chars"

echo "== 1. auth SMTP: password recovery email =="
curl -s -o /tmp/recover.json -w "recover HTTP %{http_code}\n" -X POST "$SB/auth/v1/recover" -H "apikey: $PUB" -H "Content-Type: application/json" -d "{\"email\":\"email-test@cardr-test.dev\"}"
head -c 200 /tmp/recover.json; echo ""

echo "== 2. send-transactional-email =="
curl -s -X POST "$FN/send-transactional-email" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d "{\"templateName\":\"contact-confirmation\",\"recipientEmail\":\"$TESTMAIL\",\"idempotencyKey\":\"email-test-1\",\"templateData\":{\"name\":\"Jane\"}}" | j
echo "-- duplicate (same idempotencyKey) --"
curl -s -X POST "$FN/send-transactional-email" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d "{\"templateName\":\"contact-confirmation\",\"recipientEmail\":\"$TESTMAIL\",\"idempotencyKey\":\"email-test-1\",\"templateData\":{\"name\":\"Jane\"}}" | j

echo "== 3. handle-email-unsubscribe =="
TOK=$(curl -s "$SB/rest/v1/email_unsubscribes?email=eq.$TESTMAIL&select=token" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" | python3 -c "import json,sys;r=json.load(sys.stdin);print(r[0]['token'] if r else '')")
echo "unsub token: ${#TOK} chars"
echo "-- GET validate --"
curl -s "$FN/handle-email-unsubscribe?token=$TOK" -H "apikey: $PUB" | j
echo "-- POST unsubscribe --"
curl -s -X POST "$FN/handle-email-unsubscribe" -H "apikey: $PUB" -H "Content-Type: application/json" -d "{\"token\":\"$TOK\"}" | j
echo "-- GET again (already) --"
curl -s "$FN/handle-email-unsubscribe?token=$TOK" -H "apikey: $PUB" | j
echo "-- send again (should skip: unsubscribed) --"
curl -s -X POST "$FN/send-transactional-email" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d "{\"templateName\":\"contact-confirmation\",\"recipientEmail\":\"$TESTMAIL\",\"idempotencyKey\":\"email-test-2\"}" | j
echo "-- GET invalid token --"
curl -s "$FN/handle-email-unsubscribe?token=doesnotexist123" -H "apikey: $PUB" | j

echo "== 4. send-org-invitation =="
ORG=$(curl -s -X POST "$SB/rest/v1/organizations" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"Email Test Org","slug":"email-test-org"}' | python3 -c "import json,sys;r=json.load(sys.stdin);print(r[0]['id'] if isinstance(r,list) and r else '')")
echo "org=$ORG"
curl -s -X POST "$SB/rest/v1/org_members" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"org_id\":\"$ORG\",\"user_id\":\"$UID1\",\"role\":\"owner\"}"
echo "-- invite (as owner) --"
curl -s -X POST "$FN/send-org-invitation" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d "{\"email\":\"$TESTMAIL\",\"role\":\"member\",\"orgId\":\"$ORG\"}" | j
echo "-- invite without membership (should 403) --"
ORG2="00000000-0000-0000-0000-000000000001"
curl -s -X POST "$FN/send-org-invitation" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d "{\"email\":\"$TESTMAIL\",\"role\":\"member\",\"orgId\":\"$ORG2\"}" | j

echo "== 5. resend-domain-admin =="
echo "-- as non-admin (should 403) --"
curl -s -X POST "$FN/resend-domain-admin" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"action":"list"}' | j
curl -s -X POST "$SB/rest/v1/platform_admins" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"user_id\":\"$UID1\"}"
echo "-- as platform admin: list --"
curl -s -X POST "$FN/resend-domain-admin" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"action":"list"}' | j
echo "-- current_from --"
curl -s -X POST "$FN/resend-domain-admin" -H "apikey: $PUB" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"action":"current_from"}' | j
