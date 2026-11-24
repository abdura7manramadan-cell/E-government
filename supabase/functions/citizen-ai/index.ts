const ALLOWED_ORIGIN = 'https://abdura7manramadan-cell.github.io';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

const AREA_LABELS: Record<string, string> = {
  road: 'road or sidewalk', clean: 'cleanliness and waste', health: 'health service',
  electricity: 'electricity and lighting', water: 'water and sewer', school: 'education',
  traffic: 'traffic', municipal: 'municipal service', public: 'public facility', other: 'other public issue',
};
const ISSUE_LABELS: Record<string, string> = {
  pothole: 'pothole or damaged road', sidewalk: 'damaged sidewalk or sign', lighting: 'street light failure',
  garbage: 'accumulated waste', dirty: 'dirty public place', sewage: 'blocked drain',
  hospital: 'hospital issue', clinic: 'health centre issue', service: 'other health service',
  outage: 'power outage', lamp: 'public lighting failure', hazard: 'exposed wire or hazard',
  no_water: 'water outage', leak: 'water leak', drain: 'sewer issue', school_building: 'school facility issue',
  student_service: 'student service', education_other: 'other education issue', traffic_signal: 'traffic signal',
  vehicle: 'vehicle service', traffic_other: 'other traffic issue', permit: 'municipal permit',
  maintenance: 'public maintenance', municipal_other: 'other municipal service', facility: 'damaged public facility',
  safety: 'public safety issue', public_other: 'other public facility issue', other: 'other issue',
};
const SERVICE_LABELS: Record<string, string> = {
  civil: 'civil identity document', driving: 'driving licence', vehicle: 'vehicle registration',
  school: 'student registration or transfer', school_doc: 'education certificate', health: 'health service appointment',
  electricity: 'electricity account or bill', municipal: 'building permit or municipal service',
  social: 'social support service', fine: 'traffic fine', fee: 'fee or other fine', other: 'other service',
};
const LANG_NAMES: Record<string, string> = { ar: 'Arabic', ku: 'Kurdish (Sorani)', en: 'English' };
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isCode(value: unknown, values: Record<string, string>): value is string {
  return typeof value === 'string' && Object.hasOwn(values, value);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (origin !== ALLOWED_ORIGIN) return json(403, { error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const configuredSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  let supabaseSecretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseSecretKey && configuredSecretKeys) {
    try {
      const keys = JSON.parse(configuredSecretKeys) as Record<string, unknown>;
      supabaseSecretKey = typeof keys.default === 'string' ? keys.default : '';
    } catch { /* Leave the function disabled until valid project keys are available. */ }
  }
  if (!openAiKey || !supabaseUrl || !supabaseSecretKey) return json(503, { error: 'assistant_not_configured' });

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 1500) return json(413, { error: 'request_too_large' });
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const action = input.action;
  const language = typeof input.language === 'string' && Object.hasOwn(LANG_NAMES, input.language) ? input.language : 'ar';
  let context = '';
  if (action === 'portal_guidance') {
    context = 'The user wants a short explanation of the portal: report a public issue, prepare for selected services, and track a report reference. This is an informational prototype, not a government agency.';
  } else if (action === 'report_guidance') {
    if (!isCode(input.issueArea, AREA_LABELS) || !isCode(input.issueType, ISSUE_LABELS)) return json(400, { error: 'invalid_category' });
    context = `The selected public issue category is ${AREA_LABELS[input.issueArea]}; the selected issue type is ${ISSUE_LABELS[input.issueType]}. Give a concise checklist for describing this kind of issue. Do not request personal information.`;
  } else if (action === 'report_outline') {
    if (!isCode(input.issueArea, AREA_LABELS) || !isCode(input.issueType, ISSUE_LABELS)) return json(400, { error: 'invalid_category' });
    context = `The selected public issue category is ${AREA_LABELS[input.issueArea]}; the selected issue type is ${ISSUE_LABELS[input.issueType]}. Suggest 3 to 5 factual details a citizen may include in their own report, such as what happened, when it began, service impact, and a nearby public landmark. Do not write a report on the user's behalf and do not ask for personal information.`;
  } else if (action === 'service_guidance') {
    if (!isCode(input.serviceType, SERVICE_LABELS)) return json(400, { error: 'invalid_service' });
    context = `The selected service category is ${SERVICE_LABELS[input.serviceType]}. Give a brief preparation checklist, and clearly say that current official requirements, fees, and appointments must be confirmed with the responsible institution.`;
  } else {
    return json(400, { error: 'unsupported_action' });
  }

  // The browser can send only an allow-listed action and category IDs. No free text,
  // location, contact details, photo, or report description is accepted here.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const ipAddress = request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip');
  if (!ipAddress) return json(429, { error: 'rate_limit_unavailable' });
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(openAiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ipDigest = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(ipAddress));
  const ipHash = Array.from(new Uint8Array(ipDigest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_citizen_ai_slot`, {
    method: 'POST',
    headers: { apikey: supabaseSecretKey, Authorization: `Bearer ${supabaseSecretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_ip_hash: ipHash }),
  });
  if (!rateResponse.ok) return json(503, { error: 'rate_limit_unavailable' });
  if (await rateResponse.json() !== true) return json(429, { error: 'rate_limit' });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-6.2-sol',
      instructions: `You are a concise public-service information assistant for an informational citizen portal in the Kurdistan Region. Reply in ${LANG_NAMES[language]}. Use only the fixed category context supplied. Do not claim the portal is an official government channel, invent official requirements, fees, dates, or agency decisions, or ask for names, contact details, exact addresses, or other personal data. Encourage checking current requirements with the responsible institution.`,
      input: context,
      max_output_tokens: 260,
      store: false,
    }),
  });
  if (!response.ok) return json(502, { error: 'assistant_request_failed' });
  const result = await response.json();
  const answer = (result.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
    .filter((item: { type?: string }) => item.type === 'output_text')
    .map((item: { text?: string }) => item.text || '').join('\n').trim();
  if (!answer) return json(502, { error: 'empty_answer' });
  return json(200, { answer });
});
