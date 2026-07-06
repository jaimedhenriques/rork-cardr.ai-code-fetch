#!/bin/sh
# Live verification: org-wide custom template sharing (RLS).
set -u
SB="https://jzkngsrnykozfcuifrsl.supabase.co"
PUB="sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh"
SEC="sb_secret_Te0NXU8bwdb7xcAENokCqQ_N5jQvCQD"

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d)[:500])"; }

echo "== create test users =="
curl -s -o /dev/null -w "u1 create: %{http_code}\n" -X POST "$SB/auth/v1/admin/users" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -d '{"email":"tpl-test-1@cardr-test.dev","password":"Test-Pass-123!","email_confirm":true}'
curl -s -o /dev/null -w "u2 create: %{http_code}\n" -X POST "$SB/auth/v1/admin/users" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -d '{"email":"tpl-test-2@cardr-test.dev","password":"Test-Pass-123!","email_confirm":true}'

echo "== sign in both test users =="
T1=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"tpl-test-1@cardr-test.dev","password":"Test-Pass-123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('access_token',''))")
T2=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" -H "apikey: $PUB" -H "Content-Type: application/json" -d '{"email":"tpl-test-2@cardr-test.dev","password":"Test-Pass-123!"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('access_token',''))")
U1ID=$(echo "$T1" | cut -d. -f2 | python3 -c "import base64,json,sys;s=sys.stdin.read().strip();s+='='*(-len(s)%4);print(json.loads(base64.urlsafe_b64decode(s))['sub'])")
U2ID=$(echo "$T2" | cut -d. -f2 | python3 -c "import base64,json,sys;s=sys.stdin.read().strip();s+='='*(-len(s)%4);print(json.loads(base64.urlsafe_b64decode(s))['sub'])")
echo "user1=$U1ID user2=$U2ID (tokens ${#T1}/${#T2} chars)"

if [ -z "$T1" ] || [ -z "$T2" ]; then echo "SIGN-IN FAILED, aborting"; exit 1; fi

echo "== fixtures: org + both members =="
ORG=$(curl -s -X POST "$SB/rest/v1/organizations" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"Tpl Share Test Org","slug":"tpl-share-test-org"}' | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
echo "org=$ORG"
curl -s -X POST "$SB/rest/v1/org_members" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "[{\"org_id\":\"$ORG\",\"user_id\":\"$U1ID\",\"role\":\"admin\"},{\"org_id\":\"$ORG\",\"user_id\":\"$U2ID\",\"role\":\"member\"}]"

echo; echo "== user1 creates a SHARED template =="
SHARED=$(curl -s -X POST "$SB/rest/v1/custom_note_templates" -H "apikey: $PUB" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -H "Prefer: return=representation" -d "{\"user_id\":\"$U1ID\",\"name\":\"Sales Discovery v2\",\"emoji\":\"🤝\",\"description\":\"Team discovery template\",\"fields\":[{\"key\":\"painPoints\",\"label\":\"Pain points\",\"description\":\"\",\"type\":\"list\"}],\"guidance\":\"\",\"is_shared\":true,\"org_id\":\"$ORG\"}")
echo "$SHARED" | j
SHID=$(echo "$SHARED" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")

echo; echo "== user1 creates a PRIVATE template =="
PRIV=$(curl -s -X POST "$SB/rest/v1/custom_note_templates" -H "apikey: $PUB" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -H "Prefer: return=representation" -d "{\"user_id\":\"$U1ID\",\"name\":\"My Secret Template\",\"emoji\":\"🧠\",\"fields\":[],\"guidance\":\"private\"}")
PRID=$(echo "$PRIV" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
echo "shared=$SHID private=$PRID"

echo; echo "== user2 lists templates (should see ONLY the shared one) =="
curl -s "$SB/rest/v1/custom_note_templates?select=id,name,is_shared,user_id&order=created_at.asc" -H "apikey: $PUB" -H "Authorization: Bearer $T2" | j

echo; echo "== user2 tries to UPDATE user1's shared template (should change nothing) =="
curl -s -w " HTTP %{http_code}\n" -X PATCH "$SB/rest/v1/custom_note_templates?id=eq.$SHID" -H "apikey: $PUB" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"HACKED"}'

echo "== user2 tries to DELETE user1's shared template (should delete nothing) =="
curl -s -w " HTTP %{http_code}\n" -X DELETE "$SB/rest/v1/custom_note_templates?id=eq.$SHID" -H "apikey: $PUB" -H "Authorization: Bearer $T2" -H "Prefer: return=representation"

echo "== verify template still intact (as user1) =="
curl -s "$SB/rest/v1/custom_note_templates?id=eq.$SHID&select=name,is_shared" -H "apikey: $PUB" -H "Authorization: Bearer $T1" | j

echo; echo "== user2 tries to share a template into an org they're NOT in (bogus org → should be rejected) =="
BOGUS=$(curl -s -X POST "$SB/rest/v1/organizations" -H "apikey: $SEC" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"name":"Other Org","slug":"tpl-other-org"}' | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
curl -s -w " HTTP %{http_code}\n" -X POST "$SB/rest/v1/custom_note_templates" -H "apikey: $PUB" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d "{\"user_id\":\"$U2ID\",\"name\":\"Sneaky\",\"fields\":[],\"is_shared\":true,\"org_id\":\"$BOGUS\"}"

echo; echo "== user1 lists templates (owner sees both, shared flag correct) =="
curl -s "$SB/rest/v1/custom_note_templates?select=id,name,is_shared&user_id=eq.$U1ID&order=created_at.asc" -H "apikey: $PUB" -H "Authorization: Bearer $T1" | j

echo; echo "== cleanup =="
curl -s -o /dev/null -w "del templates: %{http_code}\n" -X DELETE "$SB/rest/v1/custom_note_templates?user_id=in.($U1ID,$U2ID)" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
curl -s -o /dev/null -w "del members: %{http_code}\n" -X DELETE "$SB/rest/v1/org_members?org_id=in.($ORG,$BOGUS)" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
curl -s -o /dev/null -w "del orgs: %{http_code}\n" -X DELETE "$SB/rest/v1/organizations?id=in.($ORG,$BOGUS)" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
curl -s -o /dev/null -w "del u1: %{http_code}\n" -X DELETE "$SB/auth/v1/admin/users/$U1ID" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
curl -s -o /dev/null -w "del u2: %{http_code}\n" -X DELETE "$SB/auth/v1/admin/users/$U2ID" -H "apikey: $SEC" -H "Authorization: Bearer $SEC"
echo "done"
