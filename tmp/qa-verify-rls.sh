#!/bin/bash
SB=https://jzkngsrnykozfcuifrsl.supabase.co
KEY=sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh
TOKEN=$(cat /tmp/token.txt)
DUID=$(cat /tmp/uid.txt)
AH=(-H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
pass=0; fail=0
check() { if [ "$2" = "0" ]; then pass=$((pass+1)); echo "PASS  $1"; else fail=$((fail+1)); echo "FAIL  $1 — $3"; fi }

# Profile now readable
P=$(curl -s "${AH[@]}" "$SB/rest/v1/profiles?select=id,name,email&id=eq.$DUID")
echo "$P" | rg -q "Riley Parker"; check "profiles: own row readable" $? "$(echo "$P" | head -c 150)"

# Profile updatable
C=$(curl -s -o /tmp/upd.txt -w '%{http_code}' -X PATCH "$SB/rest/v1/profiles?id=eq.$DUID" "${AH[@]}" -H "Prefer: return=representation" -d '{"title":"Head of Partnerships"}')
[ "$C" = "200" ] && rg -q "Head of Partnerships" /tmp/upd.txt; check "profiles: own row updatable" $? "HTTP $C $(head -c 120 /tmp/upd.txt)"

# feature_flags readable
F=$(curl -s -o /dev/null -w '%{http_code}' "${AH[@]}" "$SB/rest/v1/feature_flags?select=key&limit=1")
[ "$F" = "200" ]; check "feature_flags: readable" $? "HTTP $F"

# note_tags / contact_tags accessible (200, filtered by ownership)
for t in note_tags contact_tags; do
  C=$(curl -s -o /dev/null -w '%{http_code}' "${AH[@]}" "$SB/rest/v1/$t?select=id&limit=1")
  [ "$C" = "200" ]; check "$t: accessible" $? "HTTP $C"
done

# referrals visible (own)
C=$(curl -s -o /dev/null -w '%{http_code}' "${AH[@]}" "$SB/rest/v1/referrals?select=id&limit=1")
[ "$C" = "200" ]; check "referrals: accessible" $? "HTTP $C"

# waitlist insert as anon
C=$(curl -s -o /tmp/wl.txt -w '%{http_code}' -X POST "$SB/rest/v1/platform_waitlist" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"qa-waitlist@test.dev","platform":"android"}')
[ "$C" = "201" ]; check "platform_waitlist: anon insert" $? "HTTP $C $(head -c 120 /tmp/wl.txt)"

# create_organization RPC exists + works, then clean up
ORG=$(curl -s -X POST "$SB/rest/v1/rpc/create_organization" "${AH[@]}" -d '{"_name":"QA Test Org","_slug":"qa-test-org"}')
echo "$ORG" | rg -q '^"[0-9a-f-]{36}"$'; check "create_organization RPC" $? "$(echo "$ORG" | head -c 150)"
OID=$(echo "$ORG" | tr -d '"')

if [ -n "$OID" ] && [ ${#OID} -eq 36 ]; then
  # org visible to member
  O=$(curl -s "${AH[@]}" "$SB/rest/v1/organizations?select=name&id=eq.$OID")
  echo "$O" | rg -q "QA Test Org"; check "organizations: member can read own org" $? "$(echo "$O" | head -c 120)"
  # org members visible
  M=$(curl -s "${AH[@]}" "$SB/rest/v1/org_members?select=role&org_id=eq.$OID")
  echo "$M" | rg -q "owner"; check "org_members: members list readable" $? "$(echo "$M" | head -c 120)"
fi

# SECURITY negative tests
A=$(curl -s "$SB/rest/v1/profiles?select=id&limit=1" -H "apikey: $KEY"); [ "$A" = "[]" ]; check "SEC: anon cannot read profiles" $? "$A"
A=$(curl -s "$SB/rest/v1/platform_waitlist?select=email&limit=1" -H "apikey: $KEY"); [ "$A" = "[]" ]; check "SEC: anon cannot read waitlist" $? "$A"
A=$(curl -s "${AH[@]}" "$SB/rest/v1/coupon_codes?select=code&limit=1"); [ "$A" = "[]" ]; check "SEC: non-admin cannot read coupon codes" $? "$A"
A=$(curl -s "${AH[@]}" "$SB/rest/v1/typecheck_runs?select=id&limit=1"); [ "$A" = "[]" ]; check "SEC: non-admin cannot read typecheck_runs" $? "$A"
# cannot update someone else's profile (0 rows affected)
C=$(curl -s -X PATCH "$SB/rest/v1/profiles?id=neq.$DUID" "${AH[@]}" -H "Prefer: return=representation" -d '{"title":"hacked"}')
[ "$C" = "[]" ]; check "SEC: cannot update other profiles" $? "$(echo "$C" | head -c 120)"

echo; echo "RESULT: $pass passed, $fail failed"
