import SwiftUI

/// The About page behind the i on the start screen, like the browsers' About dialog: who made the game, how and why, the
/// code on GitHub, and which build this is, with a link to its commit (`ABOUT` and `BuildInfo` in Shared/About.swift).
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme

    private var paper: Color { scheme == .dark ? Color(hex: 0x2f2620) : Color(hex: 0xfffdf6) }
    private var ink: Color { scheme == .dark ? Color(hex: 0xfff6e6) : Color(hex: 0x1b1410) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Comic(text: "About the game", size: 30, fill: Color(hex: 0xffd60a))
                ForEach(ABOUT, id: \.self) { Text($0).font(.system(size: 16)).fixedSize(horizontal: false, vertical: true) }
                buildLine
                HStack(spacing: 10) {
                    Spacer()
                    Link(destination: REPO) { label("GitHub", go: false) }
                    Button { dismiss() } label: { label("OK", go: true) }
                }
                .padding(.trailing, 3)
            }
            .foregroundColor(ink)
            .padding(20)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(paper.ignoresSafeArea())
        .presentationDetents([.medium, .large])
    }

    /// This build, all of it a link to its commit on GitHub (underlined, as in the browsers) where the build knows it.
    @ViewBuilder private var buildLine: some View {
        let build = BuildInfo.current, line = Text(build.line).font(.system(size: 13))
        if let url = build.commitURL { Link(destination: url) { line.underline() } } else { line.opacity(0.8) }
    }

    /// A button in the browsers' dialog style: comic lettering in an inked frame; the one that closes it (`go`) yellow, with
    /// a hard shadow.
    private func label(_ title: String, go: Bool) -> some View {
        Text(bangers: title, size: 22).kerning(0.5).foregroundColor(go ? Color(hex: 0x1b1410) : ink)
            .padding(.horizontal, 16).frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 12).fill(go ? Color(hex: 0xffd60a) : .clear))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
            .background(RoundedRectangle(cornerRadius: 12).fill(go ? ink : .clear).offset(x: 3, y: 3))
    }
}
