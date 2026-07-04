#!/bin/sh
# Stage 1: fixtures + non-AI function tests against the live project.
set -u
SB="https://jzkngsrnykozfcuifrsl.supabase.co"
PUB="sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh"
SEC="sb_secret_Te0NXU8bwdb7xcAENokCqQ_N5jQvCQD"
FN="$SB/functions/v1"

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d)[:400])"; }

echo "== create test users =="
U1=$(curl -s -X POST "$SB/auth/v1/admin/users" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -d '{"email":"parity-test-1@cardr-test.dev","password":"Test-Pass-123!","email_confirm":true}')
U2=$(curl -s -X POST "$SB/auth/v1/admin/users" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -d '{"email":"parity-test-2@cardr-test.dev","password":"Test-Pass-123!","email_confirm":true}')
U1ID=$(echo "$U1" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
U2ID=$(echo "$U2" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")
echo "user1=$U1ID user2=$U2ID"

echo "== sign in =="
T1=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"parity-test-1@cardr-test.dev","password":"Test-Pass-123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('access_token',''))")
T2=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"parity-test-2@cardr-test.dev","password":"Test-Pass-123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('access_token',''))")
echo "tokens: ${#T1} ${#T2} chars"

echo "== fixtures =="
curl -s -X POST "$SB/rest/v1/meeting_notes" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"user_id\":\"$U1ID\",\"title\":\"Parity Test Meeting\",\"summary\":\"A test summary.\",\"key_topics\":[\"testing\"],\"action_items\":[{\"task\":\"Verify share\"}],\"share_token\":\"paritytesttoken123\"}"
curl -s -X POST "$SB/rest/v1/coupon_codes" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d '{"code":"PARITYTEST20","discount_pct":20,"active":true}'
ORG=$(curl -s -X POST "$SB/rest/v1/organizations" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"Parity Test Org","slug":"parity-test-org"}' | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
echo "org=$ORG"
curl -s -X POST "$SB/rest/v1/org_invitations" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"org_id\":\"$ORG\",\"email\":\"parity-test-2@cardr-test.dev\",\"role\":\"member\",\"token\":\"parityinvite123\",\"expires_at\":\"2030-01-01T00:00:00Z\",\"invited_by\":\"parity-test-1@cardr-test.dev\"}"
curl -s -X POST "$SB/rest/v1/webhook_subscriptions" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"user_id\":\"$U1ID\",\"name\":\"Parity test hook\",\"url\":\"https://postman-echo.com/post\",\"provider\":\"generic\",\"events\":[\"note.created\"],\"active\":true,\"secret\":\"testsecret123\"}"
CONTACT=$(curl -s -X POST "$SB/rest/v1/contacts" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=representation" -d "{\"user_id\":\"$U1ID\",\"name\":\"Jane Prospect\",\"company\":\"Acme Robotics\",\"title\":\"VP Operations\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
echo "contact=$CONTACT"

echo; echo "== TEST get-shared-note (real) =="
curl -s -X POST "$FN/get-shared-note" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"token":"paritytesttoken123"}' | j
echo "== TEST get-shared-note (bogus → 404) =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$FN/get-shared-note" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"token":"nope"}'

echo; echo "== TEST referral-stats (user1, generates code) =="
STATS=$(curl -s -X POST "$FN/referral-stats" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d '{}')
echo "$STATS" | j
CODE=$(echo "$STATS" | python3 -c "import json,sys;print(json.load(sys.stdin).get('referral_code',''))")
echo "== TEST referral-stats (anonymous → 401) =="
curl -s -w " HTTP %{http_code}\n" -X POST "$FN/referral-stats" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{}'

echo; echo "== TEST track-referral-click (code=$CODE) =="
curl -s -X POST "$FN/track-referral-click" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d "{\"referral_code\":\"$CODE\"}" | j

echo; echo "== TEST apply-referral (user2 uses user1 code) =="
curl -s -X POST "$FN/apply-referral" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d "{\"referral_code\":\"$CODE\"}" | j
echo "== TEST apply-referral (self-referral rejected) =="
curl -s -X POST "$FN/apply-referral" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d "{\"referral_code\":\"$CODE\"}" | j
echo "== TEST apply-referral (duplicate rejected) =="
curl -s -X POST "$FN/apply-referral" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d "{\"referral_code\":\"$CODE\"}" | j

echo; echo "== re-check referral-stats reflects click+signup =="
curl -s -X POST "$FN/referral-stats" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d '{}' | j

echo; echo "== TEST validate-coupon (valid) =="
curl -s -X POST "$FN/validate-coupon" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"code":"paritytest20","plan":"pro"}' | j
echo "== TEST validate-coupon (unknown) =="
curl -s -X POST "$FN/validate-coupon" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"code":"DOESNOTEXIST"}' | j

echo; echo "== TEST RPC get_invitation_by_token =="
curl -s -X POST "$SB/rest/v1/rpc/get_invitation_by_token" -H "apikey: $PUB" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"_token":"parityinvite123"}' | j

echo; echo "== TEST accept-org-invitation (wrong user → 403) =="
curl -s -w " HTTP %{http_code}\n" -X POST "$FN/accept-org-invitation" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d '{"token":"parityinvite123"}'
echo "== TEST accept-org-invitation (user2 → success) =="
curl -s -X POST "$FN/accept-org-invitation" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d '{"token":"parityinvite123"}' | j
echo "== TEST accept-org-invitation (reuse → already used) =="
curl -s -X POST "$FN/accept-org-invitation" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d '{"token":"parityinvite123"}' | j

echo; echo "== TEST dispatch-webhook (user1 → postman-echo) =="
curl -s -X POST "$FN/dispatch-webhook" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d '{"event":"note.created","payload":{"test":true,"message":"Test event from Cardr"}}' | j
echo "== TEST dispatch-webhook (anonymous → 401) =="
curl -s -w " HTTP %{http_code}\n" -X POST "$FN/dispatch-webhook" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"event":"note.created","payload":{}}'

# stash ids for later stages
echo "$U1ID $U2ID $ORG $CONTACT $T1 $T2" > /home/user/rork-app/tmp/test-ids.txt
echo; echo "stage 1 done"
