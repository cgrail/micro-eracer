import Foundation

// shared/src/version.ts: what this build speaks online. The server is told it when the app asks (`/version`) and when it
// joins, and decides whether the app may still race there; an app it no longer races with is asked to update.

/// The same as `PROTOCOL` in version.ts (`testProtocolMatchesTheTypeScript` compares them): bumped together, in one commit.
let PROTOCOL = 4

/// The same as `APP_STORE` in version.ts (`testProtocolMatchesTheTypeScript` compares them): the app's page on the App Store,
/// which the update dialog opens when the server names none.
let APP_STORE = URL(string: "https://apps.apple.com/app/micro-e-racer/id6821823103")!

/// The same as `REPO` in version.ts (`testProtocolMatchesTheTypeScript` compares them): where the game's code is, which the
/// About page links to, with each build's own commit.
let REPO = URL(string: "https://github.com/cgrail/micro-eracer")!

/// The status (and the error's code) of a join the server refused because the app is too old: Upgrade Required.
let OUTDATED = 426
