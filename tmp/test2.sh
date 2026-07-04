#!/bin/sh
# Stage 2: AI function tests.
set -u
SB="https://jzkngsrnykozfcuifrsl.supabase.co"
PUB="sb_publishable_FjvJ6VIpXw0edrLcLMKmKQ_fR69vesh"
FN="$SB/functions/v1"
read U1ID U2ID ORG CONTACT T1 T2 < /home/user/rork-app/tmp/test-ids.txt

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d)[:600])"; }

echo "== TEST generate-sequence =="
curl -s -X POST "$FN/generate-sequence" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"goal":"Book a product demo with ops leaders met at a trade show","channel":"multi","tone":"friendly","steps":3,"audience":"VP Operations at mid-size manufacturers"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('sequence',{})
print('name:', s.get('name'))
print('description:', (s.get('description') or '')[:100])
for st in s.get('steps',[]):
    print(f\"  step {st['step_order']} [{st['channel']}] +{st['delay_days']}d subj={str(st.get('subject_template'))[:40]!r} body={st['body_template'][:60]!r}\")
"

echo; echo "== TEST enrich-event (Web Summit 2025) =="
curl -s -X POST "$FN/enrich-event" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"title":"Web Summit","website":null,"year":"2025"}' | j

echo; echo "== TEST translate-ui (fr) =="
curl -s -X POST "$FN/translate-ui" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"strings":{"nav.contacts":"Contacts","notes.newNote":"New note","common.save":"Save","scan.title":"Scan a badge","greeting":"Welcome back, {{name}}!"},"targetLang":"French"}' | j

echo; echo "== TEST generate-proposal (user1 + contact) =="
curl -s -X POST "$FN/generate-proposal" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d "{\"contact_id\":\"$CONTACT\",\"project_type\":\"SaaS implementation\",\"budget\":\"\$15k-\$30k\",\"timeline\":\"8 weeks\",\"notes\":\"They want to automate their lead capture after trade shows.\"}" | j
echo "== TEST generate-proposal (anonymous → 401) =="
curl -s -w " HTTP %{http_code}\n" -X POST "$FN/generate-proposal" -H "Authorization: Bearer $PUB" -H "Content-Type: application/json" -d '{"project_type":"Consulting"}'

echo; echo "stage 2 done"
