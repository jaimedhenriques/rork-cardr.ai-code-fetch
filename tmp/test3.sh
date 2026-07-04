#!/bin/sh
# Stage 3: delete-account live test + full fixture cleanup.
set -u
SB="https://jzkngsrnykozfcuifrsl.supabase.co"
PUB="sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh"
SEC="sb_secret_Te0NXU8bwdb7xcAENokCqQ_N5jQvCQD"
FN="$SB/functions/v1"
read U1ID U2ID ORG CONTACT T1 T2 < /home/user/rork-app/tmp/test-ids.txt

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d)[:400])"; }

echo "== TEST delete-account (missing confirm → 400) =="
curl -s -w " HTTP %{http_code}\n" -X POST "$FN/delete-account" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d '{}'
echo "== TEST delete-account (user2, confirm=DELETE) =="
curl -s -X POST "$FN/delete-account" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d '{"confirm":"DELETE"}' | j
echo "== verify user2 auth record is gone (expect 404) =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$SB/auth/v1/admin/users/$U2ID" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
echo "== verify user2 org membership purged =="
curl -s "$SB/rest/v1/org_members?user_id=eq.$U2ID&select=id" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" | j
echo "== verify audit row written =="
curl -s "$SB/rest/v1/account_deletion_audit?user_id=eq.$U2ID&select=phase,status,duration_ms" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" | j

echo; echo "== cleanup fixtures =="
D() { curl -s -o /dev/null -w "%{http_code} " -X DELETE "$1" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Prefer: return=minimal"; }
D "$SB/rest/v1/meeting_notes?share_token=eq.paritytesttoken123"
D "$SB/rest/v1/coupon_codes?code=eq.PARITYTEST20"
D "$SB/rest/v1/org_invitations?token=eq.parityinvite123"
D "$SB/rest/v1/organizations?id=eq.$ORG"
D "$SB/rest/v1/webhook_deliveries?user_id=eq.$U1ID"
D "$SB/rest/v1/webhook_subscriptions?user_id=eq.$U1ID"
D "$SB/rest/v1/proposals?user_id=eq.$U1ID"
D "$SB/rest/v1/contacts?user_id=eq.$U1ID"
D "$SB/rest/v1/referral_clicks?referral_code=eq.EV5BNJBR"
D "$SB/rest/v1/referrals?referrer_id=eq.$U1ID"
D "$SB/rest/v1/account_deletion_audit?user_id=eq.$U2ID"
D "$SB/rest/v1/profiles?id=eq.$U1ID"
echo
echo "== delete test user1 auth record =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE "$SB/auth/v1/admin/users/$U1ID" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
echo "cleanup done"
