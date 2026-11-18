/**
 * Privacy policy and terms, in plain language. Every statement must stay true of the app:
 * if data handling changes (a new service, analytics, backups), update this file in the same PR.
 */
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

const CONTACT = 'Questions or requests: open an issue at github.com/al0n50/life-plan.';

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  updated: 'November 18, 2026',
  intro:
    'Life Plan OS is a personal finance planner made by Alonso Ochoa. Your plan is your financial information, so the app collects as little as it can and never sells or shares it.',
  sections: [
    {
      heading: 'What stays on your device',
      body: [
        'Everything you enter (income, bills, debts, accounts, goals and your logs) is saved on your device: in the browser’s storage on the web, in the app’s storage on a phone.',
        'Without an account, nothing you enter leaves your device.',
      ],
    },
    {
      heading: 'If you create an account',
      body: [
        'Accounts are optional. If you create one, we keep your email address, your password (stored by our database provider in a scrambled, one-way form we can’t read) and one copy of your plan, so it can sync to your other devices.',
        'Your saved plan can only be read or changed by your account. Database rules enforce this, not just the app.',
        'Your account and plan are stored with Supabase, our database and sign-in provider, on servers in the United States.',
      ],
    },
    {
      heading: 'What we don’t do',
      body: [
        'No ads, no analytics or tracking tools, no selling or sharing your data, and no connecting to your bank.',
        'We don’t read your plan except when you ask for help with a problem and share it with us yourself.',
      ],
    },
    {
      heading: 'Services that see some technical data',
      body: [
        'The web app is hosted by Vercel. Like any website host, it briefly handles technical details such as your IP address and browser type to deliver the page.',
        'Supabase handles sign-in and stores account data as described above. Both process data only to run this app, under their own privacy policies.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'Export: Account & sync → Export my plan downloads everything as a file.',
        'Delete: Account & sync → Delete my account permanently deletes your account and the plan saved in it. The copy on your device stays until you clear it or sign out and remove it.',
        'You can use the app without an account at all.',
      ],
    },
    {
      heading: 'Children',
      body: ['Life Plan OS is not meant for children under 13, and we don’t knowingly create accounts for them.'],
    },
    {
      heading: 'Changes and contact',
      body: ['If this policy changes, the date above changes.', CONTACT],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  updated: 'November 18, 2026',
  intro: 'By using Life Plan OS you agree to these terms. They’re short on purpose.',
  sections: [
    {
      heading: 'A planning tool, not advice',
      body: [
        'Life Plan OS estimates paychecks, taxes, payoff dates and balances from what you enter. Estimates can be wrong.',
        'It isn’t financial, tax, legal or investment advice. Check important decisions with a qualified professional.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Keep your password private; you’re responsible for what happens in your account. Use a real email you can reach, so you can reset your password.',
        'Don’t misuse the service: no attempts to reach other people’s data, overload it or break its security.',
      ],
    },
    {
      heading: 'Your data',
      body: [
        'Your plan belongs to you. You can export it or delete your account at any time, as described in the privacy policy.',
        'Keep your own copy of anything important: the service is free and has no guaranteed backups.',
      ],
    },
    {
      heading: 'No guarantees',
      body: [
        'The app is provided as it is, without warranties. It may change, be unavailable at times or be discontinued. To the extent the law allows, the developer isn’t liable for losses from using it or relying on its estimates.',
      ],
    },
    {
      heading: 'Changes and contact',
      body: ['These terms may be updated; the date above shows when. Continuing to use the app means you accept the update.', CONTACT],
    },
  ],
};
