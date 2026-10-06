// Mail is never sent from tests; each message is kept in `outbox` for the test to read, and
// `mailState.fail` makes sending fail.
export type SentMail = {from: string; to: string; subject: string; html: string};
const shared = globalThis as unknown as {__edgeMail?: {outbox: SentMail[]; fail: boolean}};
export const mailState = (shared.__edgeMail ??= {outbox: [], fail: false});

export default {
  createTransport: () => ({
    sendMail: async (message: SentMail) => {
      if (mailState.fail) throw new Error('smtp down');
      mailState.outbox.push(message);
      return {};
    },
  }),
};
