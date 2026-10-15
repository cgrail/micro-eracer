import { REPO } from '../../shared/src/version.ts';

// The About dialog behind the i on the start form: who made the game, how and why (its text is in index.html), the code on
// GitHub, and which build this is, with a link to its commit (ios/Shared/About.swift for the apps)

/** The commit this page was built from ('' where the build had none) and when, which client/vite.config.ts puts in. */
declare const __COMMIT__: string, __BUILT__: string;

const two = (n: number) => String(n).padStart(2, '0');
/** When it was built, in the Player's own time zone, as the apps write it: 15 Oct 2026, 14:03. */
export const builtAt = (when: Date) =>
  `${when.getDate()} ${when.toLocaleString('en', { month: 'short' })} ${when.getFullYear()}, ${two(when.getHours())}:${two(when.getMinutes())}`;

export const setUpAbout = (open: HTMLElement, about: HTMLDialogElement) => {
  const $ = (id: string) => about.querySelector<HTMLElement>(`#${id}`)!;
  // the code on GitHub: its address written out in the text (github.com/…), and the button
  for (const link of about.querySelectorAll<HTMLAnchorElement>('a.repo')) {
    link.href = REPO;
    if (!link.textContent) link.textContent = REPO.replace(/^https:\/\//, '');
  }
  // the whole line leads to the commit, where the build knows it
  const build = $('build') as HTMLAnchorElement;
  build.textContent = `Built ${builtAt(new Date(__BUILT__))}${__COMMIT__ ? ` · Commit ${__COMMIT__.slice(0, 7)}` : ''}`;
  if (__COMMIT__) build.href = `${REPO}/commit/${__COMMIT__}`;
  open.addEventListener('click', () => about.showModal());
  $('about-done').addEventListener('click', () => about.close());
  // a tap beside it closes it too
  about.addEventListener('click', (e) => {
    const r = about.getBoundingClientRect();
    if (e.target === about && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) about.close();
  });
};
