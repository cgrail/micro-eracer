// swift-tools-version: 5.9
import PackageDescription

// The game's rules without the app around them (MicroERacer/Core, the port of shared/src), so `swift test` can check them
// against the TypeScript on a Mac: the physics fixture, the Track data and a headless Race. The app compiles the same files.
let package = Package(
    name: "MicroERacerCore",
    platforms: [.macOS(.v13)],
    targets: [
        .target(name: "Core", path: "MicroERacer/Core"),
        .testTarget(name: "CoreTests", dependencies: ["Core"], path: "Tests/CoreTests"),
    ]
)
