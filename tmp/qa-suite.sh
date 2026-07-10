#!/bin/bash
# Live QA suite for cardr — read-only + AI happy paths against deployed Supabase.
SB=https://jzkngsrnykozfcuifrsl.supabase.co
KEY=sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh
TOKEN=$(cat /tmp/token.txt)
UID=$(cat /tmp/uid.txt)
AH=(-H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

pass=0; fail=0
check() { # name, condition(0=ok), detail
  if [ "$2" = "0" ]; then pass=$((pass+1)); echo "PASS  $1"; else fail=$((fail+1)); echo "FAIL  $1 — $3"; fi
}

# ---------- REST data (RLS as demo user) ----------
for t in contacts notes events profiles pipeline_stages contact_activities usage_tracking folders note_tags; do
  body=$(curl -s "${AH[@]}" "$SB/rest/v1/$t?select=id&limit=100" -H "Prefer: count=exact" -D /tmp/h.txt)
  code=$(rg -o 'HTTP/[0-9.]+ ([0-9]+)' -r '$1' /tmp/h.txt | head -1)
  cnt=$(rg -o 'content-range: .*/(\d+)' -r '$1' /tmp/h.txt | head -1)
  [ "$code" = "200" ]; check "REST $t (count=${cnt:-?})" $? "HTTP $code: $(echo "$body" | head -c 120)"
done

# ---------- Edge functions ----------
ef() { # name path payload jq-ish grep
  local out code
  out=$(curl -s -w '\n%{http_code}' -X POST "$SB/functions/v1/$2" "${AH[@]}" -d "$3")
  code=$(echo "$out" | tail -1); body=$(echo "$out" | sed '$d')
  if [ "$code" = "200" ] && echo "$body" | rg -q "$4"; then check "$1" 0
  else check "$1" 1 "HTTP $code: $(echo "$body" | head -c 200)"; fi
}

ef "check-subscription" check-subscription '{}' '"'
ef "referral-stats" referral-stats '{}' '"'
ef "team-analytics" team-analytics '{"range":"30d"}' '"'
ef "validate-coupon (invalid code path)" validate-coupon '{"code":"NOPE123"}' 'valid|error|invalid'
ef "translate-ui" translate-ui '{"keys":{"hello":"Hello"},"targetLanguage":"es"}' '.'
ef "meeting-notes (AI summary)" meeting-notes '{"transcript":"Alice: We agreed to start the Northwind pilot on August 1. Bob: I will send the contract by Friday. Alice: Great, and lets budget 20k for phase one.","templateId":"general"}' 'summary|Summary'
ef "notes-chat (ask about meetings)" notes-chat '{"messages":[{"role":"user","content":"What did we decide with Northwind?"}],"notes":[{"id":"n1","title":"Northwind pilot","summary":"Agreed to start pilot Aug 1, Bob sends contract Friday, 20k budget.","transcript":""}]}' '.'
ef "scan-badge (text mode)" scan-badge '{"text":"Maya Chen\nVP Sales, Northwind Labs\nmaya@northwind.io\n+1 415 555 0101"}' 'name|error'
ef "get-shared-note (bad id -> clean error)" get-shared-note '{"shareId":"00000000-0000-0000-0000-000000000000"}' 'error|not'

# ai-chat is streaming — check it starts an SSE stream
out=$(curl -s -N --max-time 25 -X POST "$SB/functions/v1/ai-chat" "${AH[@]}" -d '{"messages":[{"role":"user","content":"Say hi in 3 words"}]}' | head -c 300)
echo "$out" | rg -q 'data:|delta|content'; check "ai-chat (streaming)" $? "$(echo "$out" | head -c 150)"

# get-public-card with a real slug if one exists
slug=$(curl -s "${AH[@]}" "$SB/rest/v1/profiles?select=card_slug&card_slug=not.is.null&limit=1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['card_slug'] if d else '')")
if [ -n "$slug" ]; then ef "get-public-card ($slug)" get-public-card "{\"slug\":\"$slug\"}" 'name|card|profile'; else echo "SKIP  get-public-card (no slug)"; fi

# draft-outreach with a real contact
cid=$(curl -s "${AH[@]}" "$SB/rest/v1/contacts?select=id&limit=1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")
if [ -n "$cid" ]; then ef "draft-outreach (real contact)" draft-outreach "{\"contact_id\":\"$cid\",\"tone\":\"friendly\",\"channel\":\"email\"}" '.'; else echo "SKIP  draft-outreach"; fi

# ---------- CRUD round-trip as demo user (create + delete a contact) ----------
new=$(curl -s -X POST "$SB/rest/v1/contacts" "${AH[@]}" -H "Prefer: return=representation" -d "{\"user_id\":\"$UID\",\"name\":\"QA Roundtrip\",\"email\":\"qa-roundtrip@test.dev\"}")
nid=$(echo "$new" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if isinstance(d,list) and d else '')" 2>/dev/null)
[ -n "$nid" ]; check "contact CREATE" $? "$(echo "$new" | head -c 150)"
if [ -n "$nid" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$SB/rest/v1/contacts?id=eq.$nid" "${AH[@]}")
  [ "$code" = "204" ]; check "contact DELETE" $? "HTTP $code"
fi

# ---------- RLS negative test: anon must NOT read contacts ----------
anon=$(curl -s "$SB/rest/v1/contacts?select=id&limit=1" -H "apikey: $KEY")
[ "$anon" = "[]" ]; check "RLS: anon sees no contacts" $? "$(echo "$anon" | head -c 120)"

echo; echo "RESULT: $pass passed, $fail failed"
