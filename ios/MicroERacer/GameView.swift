import SceneKit
import SwiftUI

/// What a GameView draws and drives from its render loop: a Race (`Game`) or the Practice Ground (`Practice`).
protocol Stage: SCNSceneRendererDelegate {
    var scene: SCNScene { get }
    var cameraNode: SCNNode { get }
    /// Width over height of the view, set by the view as it lays out.
    var aspect: Double { get set }
}

extension Game: Stage {}
extension Practice: Stage {}

/// The SceneKit view the game draws into; it drives its `Stage` from its render loop.
struct GameView: UIViewRepresentable {
    let game: any Stage

    func makeUIView(context: Context) -> SCNView {
        let view = SizedView()
        view.game = game
        view.scene = game.scene
        view.pointOfView = game.cameraNode
        view.delegate = game
        view.antialiasingMode = .multisampling2X
        view.preferredFramesPerSecond = 60
        view.rendersContinuously = true
        view.isPlaying = true
        view.backgroundColor = .black
        // at most twice the points: the outlines already draw everything twice
        view.contentScaleFactor = min(UIScreen.main.scale, 2)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    final class SizedView: SCNView {
        weak var game: (any Stage)?
        override func layoutSubviews() {
            super.layoutSubviews()
            game?.aspect = bounds.height > 0 ? bounds.width / bounds.height : 1
        }
    }
}
