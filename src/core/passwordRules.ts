// What a new password must have, wherever one is set (signup, set or reset password). The server
// checks the same (staff-signup, change-initial-password). The sign-in service also asks for 10 characters and
// turns down passwords known from leaks: that one cannot be checked here, its answer is `password_weak`.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

export type PasswordRule = {id: string; ok: boolean; el: string; en: string};

export const passwordRules = (password: string): PasswordRule[] => [
  {
    id: 'length',
    ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    el: `Τουλάχιστον ${PASSWORD_MIN} χαρακτήρες`,
    en: `At least ${PASSWORD_MIN} characters`,
  },
  {id: 'letter', ok: /\p{L}/u.test(password), el: 'Ένα γράμμα', en: 'A letter'},
  {id: 'digit', ok: /\d/.test(password), el: 'Ένας αριθμός', en: 'A number'},
];

export const passwordOk = (password: string) => passwordRules(password).every(r => r.ok);
