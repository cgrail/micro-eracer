import Foundation

// The About page behind the i on the start screen (#about in client/index.html, client/src/about.ts): who made the game, how
// and why, the code on GitHub, and which build this is, with a link to its commit.

/// Who made the game, how and why: the same paragraphs as the browsers' About dialog in client/index.html, with the same
/// links (the name to LinkedIn, the code's address written out to GitHub).
let ABOUT = [
    "Made by [Christian Grail](https://www.linkedin.com/in/cgrail), who works at SAP in Germany on Joule, SAP's AI assistant for business.",
    "Micro E-Racer was built with Claude Opus, Anthropic's AI, as a way to play around with AI. Every E-Car, every Track and every song in it is made in code.",
    "The goal: a game with no in-app purchases, no tracking and no ads. Just a free game that is a lot of fun.",
    "All of its code is on GitHub: [\(REPO.absoluteString.replacingOccurrences(of: "https://", with: ""))](\(REPO.absoluteString))",
].map { (text: String) -> AttributedString in (try? AttributedString(markdown: text)) ?? AttributedString(text) }

/// Which build this is: the app's version, and the commit it was built from and when, which the Build Info phase of both
/// targets writes into the bundle as BuildInfo.json (as client/vite.config.ts puts them into the browsers' page).
struct BuildInfo {
    /// "1.0 (1)": the version and the build number.
    let version: String
    /// The commit's full hash, or nil where the build had none.
    let commit: String?
    let built: Date?

    static let current: BuildInfo = {
        let info = Bundle.main.infoDictionary ?? [:]
        let version = "\(info["CFBundleShortVersionString"] as? String ?? "?") (\(info["CFBundleVersion"] as? String ?? "?"))"
        let file = Bundle.main.url(forResource: "BuildInfo", withExtension: "json").flatMap { try? Data(contentsOf: $0) }
        let json = file.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] } ?? [:]
        let commit = json["commit"].flatMap { $0.range(of: "^[0-9a-f]{40}$", options: .regularExpression) != nil ? $0 : nil }
        return BuildInfo(version: version, commit: commit, built: json["built"].flatMap { ISO8601DateFormatter().date(from: $0) })
    }()

    /// The commit on GitHub.
    var commitURL: URL? { commit.flatMap { URL(string: "\(REPO.absoluteString)/commit/\($0)") } }

    /// When it was built, in the Player's own time zone, as the browsers write it: 15 Oct 2026, 14:03.
    var builtAt: String? {
        guard let built else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "d MMM yyyy, HH:mm"
        return f.string(from: built)
    }

    /// Version 1.0 (1) · Built 15 Oct 2026, 14:03 · Commit 0b5392c: the About page makes all of it a link to the commit.
    var line: String {
        ["Version \(version)", builtAt.map { "Built \($0)" }, commit.map { "Commit \($0.prefix(7))" }].compactMap { $0 }.joined(separator: " · ")
    }
}
