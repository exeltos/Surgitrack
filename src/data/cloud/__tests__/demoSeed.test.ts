import {beforeEach, describe, expect, it, vi} from 'vitest';

const seedAppRecords = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../appRecords', () => ({seedAppRecords}));

const {seedDemoOrganization} = await import('../demoSeed');

type Library = {systemSettings?: {screenGuides?: boolean; usageWarningThreshold?: number}};
const writtenLibrary = () =>
  (seedAppRecords.mock.calls.at(-1) as unknown as [string, {library: Library[]}])[1].library[0];

beforeEach(() => seedAppRecords.mockClear());

describe('seedDemoOrganization: the screen guides', () => {
  it('writes the choice into the Demo’s settings, keeping the sample’s other settings', async () => {
    await seedDemoOrganization('org-1', {evaluation: true, screenGuides: false});
    expect(writtenLibrary().systemSettings).toMatchObject({screenGuides: false, usageWarningThreshold: 3});
  });

  it('leaves the sample’s settings as they are when nothing was chosen', async () => {
    await seedDemoOrganization('org-1', {evaluation: true});
    expect(writtenLibrary().systemSettings?.screenGuides).toBeUndefined();
  });
});
