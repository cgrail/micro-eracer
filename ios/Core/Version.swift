import Foundation

// shared/src/version.ts: what this build speaks online. The server is told it when the app asks (`/version`) and when it
// joins, and decides whether the app may still race there; an app it no longer races with is asked to update.

/// The same as `PROTOCOL` in version.ts (`testProtocolMatchesTheTypeScript` compares them): bumped together, in one commit.
let PROTOCOL = 2

/// The status (and the error's code) of a join the server refused because the app is too old: Upgrade Required.
let OUTDATED = 426
