// Mail is never sent from tests.
export default {createTransport: () => ({sendMail: async () => ({})})};
