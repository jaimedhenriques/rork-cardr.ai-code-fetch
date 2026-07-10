#!/bin/bash
SB=https://jzkngsrnykozfcuifrsl.supabase.co
KEY=sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh
TOKEN=$(cat /tmp/token.txt)
DUID=$(cat /tmp/uid.txt)
AH=(-H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "--- meeting_notes:"
curl -s "${AH[@]}" "$SB/rest/v1/meeting_notes?select=id,title&limit=10" | head -c 500
echo; echo "--- translate-ui (correct params):"
curl -s -X POST "$SB/functions/v1/translate-ui" "${AH[@]}" -d '{"strings":{"hello":"Hello"},"targetLang":"es"}' | head -c 200
echo; echo "--- profile by user_id:"
curl -s "${AH[@]}" "$SB/rest/v1/profiles?select=user_id,name,card_slug&user_id=eq.$DUID" | head -c 300
echo; echo "--- profile by id:"
curl -s "${AH[@]}" "$SB/rest/v1/profiles?select=*&id=eq.$DUID" | head -c 300
echo; echo "--- contact CREATE/DELETE roundtrip:"
NEW=$(curl -s -X POST "$SB/rest/v1/contacts" "${AH[@]}" -H "Prefer: return=representation" -d "{\"user_id\":\"$DUID\",\"name\":\"QA Roundtrip\",\"email\":\"qa-roundtrip@test.dev\"}")
NID=$(echo "$NEW" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if isinstance(d,list) and d else '')" 2>/dev/null)
if [ -n "$NID" ]; then
  C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$SB/rest/v1/contacts?id=eq.$NID" "${AH[@]}")
  echo "created $NID, delete HTTP $C"
else
  echo "CREATE FAILED: $(echo "$NEW" | head -c 200)"
fi
echo "--- event_contacts links:"
curl -s "${AH[@]}" "$SB/rest/v1/event_contacts?select=event_id,contact_id" | head -c 300
echo; echo "--- calendar_events:"
curl -s "${AH[@]}" "$SB/rest/v1/calendar_events?select=id,title&limit=5" | head -c 300
