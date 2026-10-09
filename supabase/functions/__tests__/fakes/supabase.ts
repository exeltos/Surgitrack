// A stand-in for @supabase/supabase-js, so the edge functions run under vitest. A test sets
// `fake.db` (answers for table queries) and the other fields, then inspects `fake.calls`.
export type DbCall = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters: Array<[string, string, unknown]>;
  values?: unknown;
  /** The options of an upsert (`onConflict`, `ignoreDuplicates`). */
  options?: unknown;
};
type Result = {data?: unknown; error?: {message: string} | null};

// One shared instance: vi.resetModules() reloads this file for the function under test, and the
// test must still talk to the same object.
const shared = globalThis as unknown as {__edgeFake?: typeof initial};
const initial = {
  /** The signed-in caller, as the caller's own client reports it. */
  user: null as null | {id: string; email?: string},
  db: (_call: DbCall): Result => ({data: null, error: null}),
  rpc: (_name: string, _args: unknown): Result => ({data: null, error: null}),
  signIn: (_credentials: unknown): Result => ({data: {session: null}, error: {message: 'invalid'}}),
  admin: {
    deleteUser: (_id: string): Result => ({error: null}),
    updateUserById: (_id: string, _attrs: unknown): Result => ({error: null}),
    generateLink: (_args: unknown): Result => ({data: {properties: {hashed_token: 'tok'}}, error: null}),
    inviteUserByEmail: (_email: string, _options: unknown): Result => ({data: {user: {id: 'invited-user'}}, error: null}),
    createUser: (_attrs: unknown): Result => ({data: {user: {id: 'new-user'}}, error: null}),
    signOut: (_token: string, _scope: unknown): Result => ({error: null}),
  },
  resetPassword: (_email: string, _options: unknown): Result => ({error: null}),
  calls: [] as Array<{what: string; args: unknown[]}>,
  reset() {
    this.user = null;
    this.db = () => ({data: null, error: null});
    this.rpc = () => ({data: null, error: null});
    this.signIn = () => ({data: {session: null}, error: {message: 'invalid'}});
    this.admin = {
      deleteUser: () => ({error: null}),
      updateUserById: () => ({error: null}),
      generateLink: () => ({data: {properties: {hashed_token: 'tok'}}, error: null}),
      inviteUserByEmail: () => ({data: {user: {id: 'invited-user'}}, error: null}),
      createUser: () => ({data: {user: {id: 'new-user'}}, error: null}),
      signOut: () => ({error: null}),
    };
    this.resetPassword = () => ({error: null});
    this.calls = [];
  },
  /** Database calls so far, optionally only those of one operation. */
  dbCalls(op?: DbCall['op']) {
    return this.calls.filter(c => c.what === 'db' && (!op || (c.args[0] as DbCall).op === op)).map(c => c.args[0] as DbCall);
  },
};
export const fake = (shared.__edgeFake ??= initial);

const record = (what: string, ...args: unknown[]) => fake.calls.push({what, args});

class Query implements PromiseLike<Result> {
  private call: DbCall;
  constructor(table: string) {
    this.call = {table, op: 'select', filters: []};
  }
  private run(): Result {
    record('db', this.call);
    return fake.db(this.call) ?? {data: null, error: null};
  }
  select() {
    return this;
  }
  insert(values: unknown) {
    this.call.op = 'insert';
    this.call.values = values;
    return this;
  }
  update(values: unknown) {
    this.call.op = 'update';
    this.call.values = values;
    return this;
  }
  upsert(values: unknown, options?: unknown) {
    this.call.op = 'upsert';
    this.call.values = values;
    this.call.options = options;
    return this;
  }
  delete() {
    this.call.op = 'delete';
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run());
  }
  single() {
    return Promise.resolve(this.run());
  }
  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
for (const filter of ['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'ilike', 'like', 'not', 'or', 'order', 'limit']) {
  (Query.prototype as unknown as Record<string, unknown>)[filter] = function (this: Query, ...args: unknown[]) {
    (this as unknown as {call: DbCall}).call.filters.push([filter, String(args[0]), args[1]]);
    return this;
  };
}

export const createClient = (_url: string, _key: string, options?: {global?: {headers?: Record<string, string>}}) => ({
  from: (table: string) => new Query(table),
  rpc: (name: string, args: unknown) => {
    record('rpc', name, args);
    return Promise.resolve(fake.rpc(name, args));
  },
  auth: {
    getUser: () => Promise.resolve({data: {user: fake.user}, error: null}),
    signInWithPassword: (credentials: unknown) => {
      record('signIn', credentials);
      return Promise.resolve(fake.signIn(credentials));
    },
    admin: {
      deleteUser: (id: string) => {
        record('deleteUser', id);
        return Promise.resolve(fake.admin.deleteUser(id));
      },
      updateUserById: (id: string, attrs: unknown) => {
        record('updateUserById', id, attrs);
        return Promise.resolve(fake.admin.updateUserById(id, attrs));
      },
      generateLink: (args: unknown) => {
        record('generateLink', args);
        return Promise.resolve(fake.admin.generateLink(args));
      },
      signOut: (token: string, scope: unknown) => {
        record('signOut', token, scope);
        return Promise.resolve().then(() => fake.admin.signOut(token, scope));
      },
      inviteUserByEmail: (email: string, options: unknown) => {
        record('inviteUserByEmail', email, options);
        return Promise.resolve(fake.admin.inviteUserByEmail(email, options));
      },
      createUser: (attrs: unknown) => {
        record('createUser', attrs);
        return Promise.resolve(fake.admin.createUser(attrs));
      },
    },
    resetPasswordForEmail: (email: string, options: unknown) => {
      record('resetPasswordForEmail', email, options);
      return Promise.resolve(fake.resetPassword(email, options));
    },
  },
  _authorization: options?.global?.headers?.Authorization,
});
export type SupabaseClient = ReturnType<typeof createClient>;
