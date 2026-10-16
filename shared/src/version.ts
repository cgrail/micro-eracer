// Whether a client may race online. A browser runs what the server served it, but a tab can stay open across deploys and
// an app runs the build it was installed with for weeks, so every client says what it speaks and the server decides.

/**
 * What this build speaks online: the rules and the physics in `shared/`, the room's state, its messages and `RaceEvent`.
 * Bump it when an older client would race wrong against this server (it drives differently, or reads a field that was
 * renamed), and raise `MIN_PROTOCOL` with it when those clients must stop racing online. The apps keep their own copy in
 * ios/Core/Version.swift, which `swift test` compares with this one.
 * 1: the apps from before this check, which send none. 2: clients that ask first and race the Track the room sends.
 * 3: clients that draw a field of any size, up to MAX_SEATS (race.ts); a 2 only draws 8 E-Cars.
 */
export const PROTOCOL = 3;

/** The oldest client the server still races with; an older one is asked to update and may only race offline. */
export const MIN_PROTOCOL = 3;

/** The HTTP status (and the error's code) of a join refused because the client is too old: Upgrade Required. */
export const OUTDATED = 426;

/** The app's page on the App Store: where the browser game offers the app on an iPhone or iPad, and where an app too old to
 * race online gets the new one. The apps keep their own copy in ios/Core/Version.swift, which `swift test` compares. */
export const APP_STORE = 'https://apps.apple.com/app/micro-e-racer/id6821823103';

/** Where the game's code is, which the About dialog links to, with each build's own commit. The apps keep their own copy
 * in ios/Core/Version.swift, which `swift test` compares. */
export const REPO = 'https://github.com/cgrail/micro-eracer';

/** The version a client sent: a whole number from 1, or 1 for a client that sent none (an app from before this check). */
export const protocolOf = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : typeof v === 'string' && /^[1-9]\d{0,5}$/.test(v) ? Number(v) : 1);

/** Whether a client of this protocol may race online. */
export const compatible = (protocol: number) => protocol >= MIN_PROTOCOL;

/** The server's answer at `/version`: what it speaks, the oldest it races with, and whether the asking client is one of them. */
export interface VersionInfo {
  protocol: number;
  minProtocol: number;
  compatible: boolean;
  /** Where an app too old for online Races gets the new one: `APP_STORE`, or the server's `APP_STORE_URL` in its place. */
  update?: string;
}
