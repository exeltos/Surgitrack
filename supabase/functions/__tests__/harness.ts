import {vi} from 'vitest';
import {fake, type DbCall} from './fakes/supabase';
import {mailState} from './fakes/nodemailer';

type Handler = (req: Request) => Response | Promise<Response>;

export const env: Record<string, string> = {};
const denoStub = {
  env: {get: (key: string) => env[key]},
  serve: (_handler: Handler): void => {
    throw new Error('Deno.serve is replaced per load');
  },
};
(globalThis as unknown as {Deno: typeof denoStub}).Deno = denoStub;

const modules = import.meta.glob('../*/index.ts');

/** Loads one edge function and returns the request handler it registers with Deno.serve. */
export async function loadFunction(name: string): Promise<Handler> {
  let handler: Handler | undefined;
  denoStub.serve = h => {
    handler = h;
  };
  vi.resetModules();
  await modules[`../${name}/index.ts`]();
  if (!handler) throw new Error(`${name} did not call Deno.serve`);
  return handler;
}

export const resetFake = () => {
  fake.reset();
  mailState.outbox.length = 0;
  mailState.fail = false;
  for (const key of Object.keys(env)) delete env[key];
  env.SUPABASE_URL = 'http://localhost:54321';
  env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  env.SUPABASE_ANON_KEY = 'anon-key';
};

export const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/fn', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer caller-token', ...headers},
    body: JSON.stringify(body),
  });

export {mailState};

/** The value a query compared a column with (`.eq(column, value)`), if it did. */
export const eqValue = (call: DbCall, column: string) => call.filters.find(([op, name]) => op === 'eq' && name === column)?.[2];

/** Answers table queries from a map keyed "table:op"; a function gets the query and picks its answer. */
export const answerTables = (routes: Record<string, unknown | ((call: DbCall) => unknown)>) => {
  fake.db = call => {
    const answer = routes[`${call.table}:${call.op}`];
    return {data: typeof answer === 'function' ? (answer as (c: DbCall) => unknown)(call) : (answer ?? null), error: null};
  };
};
