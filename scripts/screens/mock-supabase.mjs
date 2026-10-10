/**
 * A small in-memory stand-in for the Supabase project, served through Playwright's request routing:
 *  - Auth (/auth/v1/*): the seeded session's user, token refresh, sign-out.
 *  - PostgREST (/rest/v1/<table>, /rest/v1/rpc/<fn>): rows from the app's own Demo sample hospital,
 *    with the filters, ordering, ranges, counts and single-row reads the app uses. Writes are applied
 *    to memory, so the app stays consistent while a page is open.
 *  - Edge functions (/functions/v1/*): canned answers (the signup link; a hand-over signature checked against
 *    the hospital's people and HANDOVER_PASSWORD; otherwise {ok:true}).
 *  - Realtime (wss://…/realtime/v1/websocket): joins are acknowledged with the client's own bindings.
 * Nothing here talks to the network.
 */

export const PROJECT_REF = 'oklyqnoqzbhjudqbkulq';
export const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
export const ORG_ID = '7f3c2a10-5b6d-4e8f-9a01-23456789abcd';
export const JOIN_TOKEN = '0123456789abcdef0123456789abcdef';

const b64url = value =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** The people the harness can sign in as, one per role. */
export const ACCOUNTS = {
  ADMIN: {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@hospital.test',
    name: 'Αριστείδης Φιλοκώστας',
    role: 'ADMIN',
    department: 'Κεντρική Αποστείρωση',
  },
  STERILIZATION: {
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'sterilization@hospital.test',
    name: 'Μαρία Παπαδοπούλου',
    role: 'STERILIZATION',
    department: 'Κεντρική Αποστείρωση',
  },
  // A Sterilization user the hospital admin named supervisor (registers assets, sees the overview).
  SUPERVISOR: {
    id: 'a0000000-0000-4000-8000-000000000006',
    email: 'supervisor@hospital.test',
    name: 'Γεώργιος Αντωνίου',
    role: 'STERILIZATION',
    supervisor: true,
    department: 'Κεντρική Αποστείρωση',
  },
  DEPARTMENT: {
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'or@hospital.test',
    name: 'Νίκος Δημητρίου',
    role: 'DEPARTMENT',
    department: 'Χειρουργείο',
  },
  VIEWER: {
    id: 'a0000000-0000-4000-8000-000000000004',
    email: 'viewer@hospital.test',
    name: 'Ελένη Κωνσταντίνου',
    role: 'VIEWER',
    department: '',
  },
  // The platform owner: recognised by this email, belongs to no hospital (Studio).
  PLATFORM: {
    id: 'a0000000-0000-4000-8000-000000000005',
    email: 'info@exeltos.com',
    name: 'Platform Admin',
    role: 'ADMIN',
    department: '',
  },
};

export const authUser = account => ({
  id: account.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: account.email,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  app_metadata: {provider: 'email', providers: ['email']},
  user_metadata: {full_name: account.name},
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  is_anonymous: false,
});

/** A session in the shape supabase-js keeps in localStorage (valid for a year, never refreshed). */
export const fakeSession = account => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 365 * 24 * 3600;
  const access_token = [
    b64url({alg: 'HS256', typ: 'JWT'}),
    b64url({sub: account.id, email: account.email, role: 'authenticated', aud: 'authenticated', iat: now, exp}),
    b64url('signature'),
  ].join('.');
  return {
    access_token,
    token_type: 'bearer',
    expires_in: exp - now,
    expires_at: exp,
    refresh_token: 'fake-refresh-token',
    user: authUser(account),
  };
};

/** The database: the seeded hospital plus the account/organization tables around it. */
export function createDatabase(seed) {
  const library = seed.library;
  const departments = (library.departments || []).map(d => ({
    id: d.id,
    organization_id: ORG_ID,
    name: d.el,
    code: d.code || null,
    active: true,
  }));
  const departmentId = name => departments.find(d => d.name === name)?.id || null;
  const profile = (account, extra = {}) => ({
    id: account.id,
    organization_id: ORG_ID,
    name: account.name,
    email: account.email,
    user_code: account.email.split('@')[0],
    role: account.role,
    supervisor: !!account.supervisor,
    active: true,
    demo_enabled: false,
    department_id: departmentId(account.department),
    department: account.department ? {name: account.department} : null,
    ...extra,
  });
  const profiles = ['ADMIN', 'STERILIZATION', 'SUPERVISOR', 'DEPARTMENT', 'VIEWER'].map(role =>
    profile(ACCOUNTS[role]),
  );
  const extraPeople = [
    ['Χρήστος Μπακάλης', 'STERILIZATION', 'Κεντρική Αποστείρωση'],
    ['Σοφία Μαυρίδου', 'DEPARTMENT', 'Ορθοπεδική Κλινική'],
    ['Δημήτρης Λαμπρόπουλος', 'DEPARTMENT', 'Γυναικολογική Κλινική'],
    ['Κατερίνα Ιωάννου', 'DEPARTMENT', 'ΜΕΘ', {active: false}],
  ];
  extraPeople.forEach(([name, role, department, extra], i) =>
    profiles.push(
      profile(
        {
          id: `b0000000-0000-4000-8000-00000000000${i + 1}`,
          email: `staff${i + 1}@hospital.test`,
          name,
          role,
          department,
        },
        extra,
      ),
    ),
  );
  const iso = days => new Date(Date.now() + days * 864e5).toISOString();
  return {
    ...structuredClone(seed.tables),
    organizations: [
      {
        id: ORG_ID,
        name: 'Γενικό Νοσοκομείο Δοκιμών',
        code: 'GN-TEST',
        active: true,
        is_demo: false,
        evaluation: false,
        demo_enabled: false,
        plan: 'STANDARD',
        trial_ends_at: null,
        created_at: iso(-200),
      },
      {
        id: '7f3c2a10-5b6d-4e8f-9a01-23456789abce',
        name: 'Κλινική Βορρά',
        code: 'CL-NORTH',
        active: true,
        is_demo: false,
        evaluation: false,
        demo_enabled: false,
        plan: 'TRIAL',
        trial_ends_at: iso(20),
        created_at: iso(-10),
      },
    ],
    departments,
    profiles,
    staff_access_requests: [
      {
        id: 'c0000000-0000-4000-8000-000000000001',
        organization_id: ORG_ID,
        full_name: 'ΠΑΝΑΓΙΩΤΗΣ ΡΗΓΑΣ',
        email: 'p.rigas@hospital.test',
        status: 'PENDING',
        department_id: departmentId('Χειρουργείο'),
        requested_at: iso(-1),
        user_id: null,
        user_code: 'prigas',
        invite_token: null,
        invited_role: null,
        supervisor: false,
        invited_at: null,
      },
    ],
    user_invitations: [
      {
        organization_id: ORG_ID,
        email: 'new.nurse@hospital.test',
        full_name: 'ΑΝΝΑ ΝΙΚΟΛΑΟΥ',
        status: 'SENT',
        last_sent_at: iso(-2),
        invited_at: iso(-2),
      },
    ],
    signup_links: [
      {organization_id: ORG_ID, token: JOIN_TOKEN, expires_at: iso(14), revoked_at: null, created_at: iso(-1)},
    ],
    devices: [
      {
        id: 'd0000000-0000-4000-8000-000000000001',
        organization_id: ORG_ID,
        name: 'Κλίβανος 1',
        kind: 'STERILIZER',
        manufacturer: 'MATACHANA',
        model: 'S1000',
        serial_number: 'MT-2291',
        location: 'Κεντρική Αποστείρωση',
        connection: 'API',
        active: true,
        key_hint: 'k3f9',
        last_seen_at: iso(-0.02),
      },
      {
        id: 'd0000000-0000-4000-8000-000000000002',
        organization_id: ORG_ID,
        name: 'Πλυντήριο 2',
        kind: 'WASHER',
        manufacturer: 'MIELE',
        model: 'PG 8528',
        serial_number: 'MI-7781',
        location: 'Κεντρική Αποστείρωση',
        connection: 'FILE',
        active: true,
        key_hint: null,
        last_seen_at: null,
      },
    ],
    device_readings: [
      {
        id: 'e0000000-0000-4000-8000-000000000001',
        organization_id: ORG_ID,
        device_id: 'd0000000-0000-4000-8000-000000000001',
        cycle_number: '1042',
        program: '134°C 5΄',
        started_at: iso(-0.1),
        ended_at: iso(-0.06),
        result: 'PASS',
        max_temperature: 134.6,
        max_pressure: 3.1,
        duration_minutes: 52,
        source: 'API',
        created_at: iso(-0.06),
      },
    ],
    platform_settings: [
      {
        id: true,
        contact_name: 'SurgiTrack Support',
        contact_email: 'support@example.test',
        contact_phone: '210 000 0000',
        // SCREENS_MAINTENANCE=1 shows the owner's notice to every user.
        maintenance_message:
          process.env.SCREENS_MAINTENANCE === '1'
            ? 'Προγραμματισμένη συντήρηση την Κυριακή 22:00–23:00. Η εφαρμογή θα είναι διαθέσιμη μόνο για ανάγνωση.'
            : null,
        maintenance_until: process.env.SCREENS_MAINTENANCE === '1' ? iso(3) : null,
      },
    ],
    // SCREENS_MAINTENANCE=1 shows the owner's notices to every user (one showing, one scheduled, one ended).
    platform_notices:
      process.env.SCREENS_MAINTENANCE === '1'
        ? [
            {
              id: 'notice-1',
              message:
                'Προγραμματισμένη συντήρηση την Κυριακή 22:00–23:00. Η εφαρμογή θα είναι διαθέσιμη μόνο για ανάγνωση.',
              starts_at: iso(-0.5),
              ends_at: iso(3),
              created_at: iso(-0.5),
              created_by_name: 'Platform Admin',
            },
            {
              id: 'notice-2',
              message: 'Νέα έκδοση με φόρτωση πλυντηρίου την Τρίτη.',
              starts_at: iso(4),
              ends_at: iso(6),
              created_at: iso(-0.2),
              created_by_name: 'Platform Admin',
            },
            {
              id: 'notice-3',
              message: 'Διακοπή ρεύματος στο data center, 15 λεπτά.',
              starts_at: iso(-9),
              ends_at: iso(-8.9),
              created_at: iso(-9),
              created_by_name: 'Platform Admin',
            },
          ]
        : [],
    deleted_records: [],
    asset_imports: [],
    demo_accounts: [],
    demo_requests: [],
    demo_feedback: [],
    demo_guide_progress: [],
    demo_seed_runs: [],
  };
}

// ---------- PostgREST ----------

const splitTop = text => {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
};
const unquote = v => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
const cmp = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
};
const coerce = (cell, raw) => {
  if (typeof cell === 'number') return Number(raw);
  if (typeof cell === 'boolean') return raw === 'true';
  return raw;
};

/** One "op.value" condition on a cell. */
const test = (cell, expr) => {
  let negate = false;
  if (expr.startsWith('not.')) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const raw = expr.slice(dot + 1);
  let ok;
  switch (op) {
    case 'eq':
      ok = cell !== undefined && cell !== null && cell === coerce(cell, unquote(raw));
      break;
    case 'neq':
      ok = cell !== coerce(cell, unquote(raw));
      break;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (cell === null || cell === undefined) {
        ok = false;
        break;
      }
      const c = cmp(cell, coerce(cell, unquote(raw)));
      ok = op === 'gt' ? c > 0 : op === 'gte' ? c >= 0 : op === 'lt' ? c < 0 : c <= 0;
      break;
    }
    case 'in': {
      const values = splitTop(raw.replace(/^\(|\)$/g, '')).map(unquote);
      ok = values.some(v => cell === coerce(cell, v));
      break;
    }
    case 'is':
      ok = raw === 'null' ? cell === null || cell === undefined : cell === (raw === 'true');
      break;
    case 'like':
    case 'ilike': {
      const re = new RegExp(
        `^${unquote(raw)
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/[*%]/g, '.*')}$`,
        op === 'ilike' ? 'i' : '',
      );
      ok = typeof cell === 'string' && re.test(cell);
      break;
    }
    default:
      ok = true; // unknown operators do not filter
  }
  return negate ? !ok : ok;
};

/** "a.eq.1,b.gte.2" inside or=(…) / and=(…). */
const logical = (row, kind, body) => {
  const parts = splitTop(body.replace(/^\(|\)$/g, '')).map(part => {
    const m = /^(or|and)(\(.*\))$/.exec(part);
    if (m) return logical(row, m[1], m[2]);
    const dot = part.indexOf('.');
    return test(row[part.slice(0, dot)], part.slice(dot + 1));
  });
  return kind === 'or' ? parts.some(Boolean) : parts.every(Boolean);
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

const query = (rows, params) => {
  let out = rows.filter(row => {
    for (const [key, value] of params) {
      if (RESERVED.has(key)) continue;
      if (key === 'or' || key === 'and') {
        if (!logical(row, key, value)) return false;
        continue;
      }
      if (key.includes('.')) continue; // filters on embedded resources: not modelled
      if (!test(row[key], value)) return false;
    }
    return true;
  });
  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map(part => {
      const [column, dir = 'asc', nulls] = part.split('.');
      return {column, desc: dir === 'desc', nulls};
    });
    out = [...out].sort((a, b) => {
      for (const {column, desc} of keys) {
        const c = cmp(a[column], b[column]);
        if (c) return desc ? -c : c;
      }
      return 0;
    });
  }
  return out;
};

const json = (status, body, headers = {}) => ({
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-range, x-supabase-api-version',
    ...headers,
  },
  body: body === undefined ? '' : JSON.stringify(body),
});

const RPC = {
  claim_platform_admin: () => null,
  my_access_request: () => null,
  demo_seats_left: () => null,
  platform_list_departments: db => db.departments,
};

const FUNCTIONS = {
  'staff-signup': (db, body) =>
    body?.action === 'info'
      ? {
          organization_name: db.organizations[0].name,
          expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
          email: null,
          department_id: null,
          needs_department: true,
          departments: db.departments.map(d => ({id: d.id, name: d.name, code: d.code})),
        }
      : {ok: true, user_code: 'newuser'},
  // A hand-over signed by a colleague of the hospital: their user code and HANDOVER_PASSWORD.
  'verify-handover': (db, body, account) => {
    const signer = db.profiles.find(
      p =>
        p.active && p.organization_id === ORG_ID && p.user_code.toUpperCase() === String(body?.user_code).toUpperCase(),
    );
    if (!signer || body?.password !== HANDOVER_PASSWORD) return {status: 401, body: {error: 'invalid'}};
    if (signer.id === account?.id) return {status: 409, body: {error: 'same_user'}};
    return {
      user_id: signer.id,
      name: signer.name,
      user_code: signer.user_code.toUpperCase(),
      role: signer.role,
      department: signer.department?.name || '',
    };
  },
};
/** The password every account signs a hand-over with (verify-handover). */
export const HANDOVER_PASSWORD = 'handover-pass';

/**
 * Handles one request to the Supabase origin. Returns {status, headers, body}.
 * `account` is the signed-in account (or null when signed out).
 */
export function handleSupabase(db, account, {method, url, headers, body}) {
  const u = new URL(url);
  const path = u.pathname;
  if (method === 'OPTIONS')
    return {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
        'access-control-expose-headers': 'content-range, x-supabase-api-version',
      },
      body: '',
    };
  let payload;
  try {
    payload = body ? JSON.parse(body) : undefined;
  } catch {
    payload = undefined;
  }

  // ----- Auth
  if (path.startsWith('/auth/v1/')) {
    const what = path.slice('/auth/v1/'.length);
    if (what === 'user') return account ? json(200, authUser(account)) : json(401, {code: 401, msg: 'no session'});
    if (what === 'token') {
      return account
        ? json(200, fakeSession(account))
        : json(400, {error: 'invalid_grant', error_description: 'Invalid login credentials'});
    }
    if (what === 'logout') return {status: 204, headers: {'access-control-allow-origin': '*'}, body: ''};
    if (what === 'settings') return json(200, {external: {email: true}, disable_signup: false});
    return json(200, {});
  }

  // ----- Edge functions
  if (path.startsWith('/functions/v1/')) {
    const name = path.slice('/functions/v1/'.length);
    const fn = FUNCTIONS[name];
    const out = fn ? fn(db, payload, account) : {ok: true};
    // A function answers {status, body} to refuse, else the body itself.
    return out && typeof out.status === 'number' && 'body' in out ? json(out.status, out.body) : json(200, out);
  }

  // ----- Storage (photos): an empty 1x1 PNG
  if (path.startsWith('/storage/v1/')) {
    return {
      status: 200,
      headers: {'content-type': 'image/png', 'access-control-allow-origin': '*'},
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
        'base64',
      ),
    };
  }

  // ----- PostgREST
  if (path.startsWith('/rest/v1/')) {
    const name = path.slice('/rest/v1/'.length);
    if (name.startsWith('rpc/')) {
      const fn = RPC[name.slice(4)];
      return json(200, fn ? fn(db, payload) : null);
    }
    const table = (db[name] ??= []);
    const params = u.searchParams;
    const prefer = headers['prefer'] || '';
    const accept = headers['accept'] || '';
    const single = accept.includes('vnd.pgrst.object');
    const representation = prefer.includes('return=representation');
    const stamp = new Date().toISOString();

    if (method === 'GET' || method === 'HEAD') {
      const all = query(table, params);
      const offset = Number(params.get('offset') || 0);
      const limit = params.has('limit') ? Number(params.get('limit')) : all.length;
      const page = all.slice(offset, offset + limit);
      const range = `${page.length ? `${offset}-${offset + page.length - 1}` : '*'}/${prefer.includes('count=') ? all.length : '*'}`;
      if (single) {
        if (page.length !== 1)
          return json(406, {
            code: 'PGRST116',
            details: `The result contains ${page.length} rows`,
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned',
          });
        return json(200, page[0], {'content-range': range});
      }
      if (method === 'HEAD') {
        const {body: _body, ...head} = json(200, undefined, {'content-range': range});
        return head;
      }
      return json(200, page, {'content-range': range});
    }

    if (method === 'POST') {
      const rows = (Array.isArray(payload) ? payload : [payload]).filter(Boolean);
      const conflict = (params.get('on_conflict') || 'id').split(',');
      const ignore = prefer.includes('ignore-duplicates');
      const written = [];
      for (const incoming of rows) {
        const row = {...incoming};
        delete row.expected_updated_at;
        row.id ??= crypto.randomUUID();
        row.created_at ??= stamp;
        row.updated_at = stamp;
        const index = table.findIndex(existing => conflict.every(c => existing[c] === row[c]));
        if (index >= 0) {
          if (ignore) continue;
          table[index] = {...table[index], ...row};
          written.push(table[index]);
        } else {
          table.unshift(row);
          written.push(row);
        }
      }
      if (!representation) return {status: 201, headers: {'access-control-allow-origin': '*'}, body: ''};
      return json(201, single ? written[0] || null : written);
    }

    if (method === 'PATCH') {
      const matched = query(table, params);
      const changes = {...(payload || {})};
      delete changes.expected_updated_at;
      matched.forEach(row => Object.assign(row, changes, {updated_at: stamp}));
      if (!representation) return {status: 204, headers: {'access-control-allow-origin': '*'}, body: ''};
      return json(200, single ? matched[0] || null : matched);
    }

    if (method === 'DELETE') {
      const matched = new Set(query(table, params));
      db[name] = table.filter(row => !matched.has(row));
      if (!representation) return {status: 204, headers: {'access-control-allow-origin': '*'}, body: ''};
      return json(200, [...matched]);
    }
  }
  return json(404, {message: `mock: no handler for ${method} ${path}`});
}

/** Answers the Realtime socket: joins succeed with the client's bindings, heartbeats are acknowledged. */
export function handleRealtime(ws) {
  ws.onMessage(message => {
    let msg;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : message.toString());
    } catch {
      return;
    }
    const array = Array.isArray(msg);
    const [joinRef, ref, topic, event, payload] = array
      ? msg
      : [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
    let response = {};
    if (event === 'phx_join') {
      const changes = payload?.config?.postgres_changes || [];
      response = {postgres_changes: changes.map((c, i) => ({...c, id: i + 1}))};
    } else if (!['heartbeat', 'phx_leave', 'access_token'].includes(event)) return;
    const reply = {status: 'ok', response};
    ws.send(
      JSON.stringify(
        array
          ? [joinRef, ref, topic, 'phx_reply', reply]
          : {join_ref: joinRef, ref, topic, event: 'phx_reply', payload: reply},
      ),
    );
    if (event === 'phx_join')
      ws.send(
        JSON.stringify(
          array
            ? [
                joinRef,
                null,
                topic,
                'system',
                {status: 'ok', message: 'Subscribed', extension: 'postgres_changes', channel: topic},
              ]
            : {
                topic,
                event: 'system',
                payload: {status: 'ok', message: 'Subscribed', extension: 'postgres_changes'},
                ref: null,
              },
        ),
      );
  });
}
