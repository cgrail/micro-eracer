import SwiftUI

extension Color {
    init(hex: Int, opacity: Double = 1) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: opacity)
    }
}

/// Comic lettering: Bangers, outlined in ink with a hard shadow.
struct Comic: View {
    let text: String, size: CGFloat
    var fill = Color.white
    var body: some View {
        let font = Font.custom("Bangers-Regular", size: size)
        ZStack {
            ForEach(Array([(-2, -2), (2, -2), (-2, 2), (2, 2), (3, 3), (0, -2), (0, 2), (-2, 0), (2, 0)].enumerated()), id: \.offset) { _, o in
                Text(text).font(font).foregroundColor(Color(hex: 0x111111)).offset(x: CGFloat(o.0), y: CGFloat(o.1))
            }
            Text(text).font(font).foregroundColor(fill)
        }
        .kerning(1)
    }
}
