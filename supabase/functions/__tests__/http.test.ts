// @vitest-environment node
import {beforeEach, describe, expect, it} from 'vitest';
import {env, resetFake} from './harness';
import {APP_ORIGIN, SITE, clientIp, corsFor, jsonWith} from '../_shared/http';

const base = {'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const withOrigin = (origin?: string) => new Request('http://localhost/fn', {headers: origin ? {Origin: origin} : {}});
const allowOrigin = (origin?: string) => corsFor(withOrigin(origin), base)['Access-Control-Allow-Origin'];

beforeEach(resetFake);

describe('corsFor', () => {
  it.each([
    'https://surgitrack-med.netlify.app',
    'https://deploy-preview-55--surgitrack-med.netlify.app',
    'http://localhost:5174',
  ])('answers the app origin %s with itself', origin => {
    expect(allowOrigin(origin)).toBe(origin);
  });

  it.each([
    'https://evil.example',
    'https://surgitrack-med.netlify.app.evil.example',
    'https://evilsurgitrack-med.netlify.app',
    'http://surgitrack-med.netlify.app',
    'http://localhost.evil.example:5174',
    'null',
  ])('refuses %s by naming the production site instead', origin => {
    expect(allowOrigin(origin)).toBe(SITE);
  });

  it('names the production site when there is no Origin (not a browser)', () => {
    expect(allowOrigin()).toBe(SITE);
  });

  it('allows extra origins from ALLOWED_ORIGINS, ignoring a trailing slash', () => {
    env.ALLOWED_ORIGINS = 'https://app.example.gr/, https://other.example';
    expect(allowOrigin('https://app.example.gr')).toBe('https://app.example.gr');
    expect(allowOrigin('https://app.example.gr/')).toBe('https://app.example.gr');
    expect(allowOrigin('https://other.example')).toBe('https://other.example');
    expect(allowOrigin('https://third.example')).toBe(SITE);
  });

  it('keeps the base headers and varies by origin', () => {
    const cors: Record<string, string> = corsFor(withOrigin('http://localhost:5174'), base);
    expect(cors['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(cors.Vary).toBe('Origin');
  });

  it('matches the pattern emailed links are checked against', () => {
    expect(APP_ORIGIN.test(SITE)).toBe(true);
  });
});

describe('jsonWith', () => {
  it('sends JSON with the status and the CORS headers', async () => {
    const response = jsonWith({'Access-Control-Allow-Origin': SITE})({error: 'x'}, 418);
    expect(response.status).toBe(418);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(await response.json()).toEqual({error: 'x'});
  });

  it('defaults to 200', () => {
    expect(jsonWith({})({ok: true}).status).toBe(200);
  });
});

describe('clientIp', () => {
  const request = (headers: Record<string, string>) => new Request('http://localhost/fn', {headers});

  it('prefers cf-connecting-ip, which the client cannot set', () => {
    expect(clientIp(request({'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2'}))).toBe('203.0.113.9');
  });

  it('does not trust the first x-forwarded-for entry, which the client controls', () => {
    expect(clientIp(request({'x-forwarded-for': '6.6.6.6, 203.0.113.9'}))).toBe('203.0.113.9');
  });

  it('is "unknown" with no address at all', () => {
    expect(clientIp(request({}))).toBe('unknown');
  });
});
