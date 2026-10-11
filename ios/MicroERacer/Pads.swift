import GameController

/// The keys of client/src/input.ts on an iPad's hardware keyboard: arrows or WASD drive, Space, E or Shift uses the Item, and
/// Space held keeps a Zap firing. A game controller as in racing games: the left stick or the d-pad steers, the right trigger
/// (or A) accelerates, the left trigger (or B) brakes and reverses, and X or the right shoulder uses the Item.
func pollPads() -> Pad {
    var pad = Pad()
    if let keys = GCKeyboard.coalesced?.keyboardInput {
        let on = { (codes: [GCKeyCode]) in codes.contains { keys.button(forKeyCode: $0)?.isPressed == true } ? 1.0 : 0 }
        pad.throttle = on([.upArrow, .keyW]) - on([.downArrow, .keyS])
        pad.steer = on([.rightArrow, .keyD]) - on([.leftArrow, .keyA])
        pad.fire = on([.spacebar]) > 0
        pad.use = on([.spacebar, .keyE, .leftShift, .rightShift]) > 0
    }
    for g in GCController.controllers().compactMap(\.extendedGamepad) {
        let stick = Double(g.leftThumbstick.xAxis.value)
        // a small dead zone, so a stick resting off-centre doesn't steer
        let steer = abs(stick) > 0.15 ? stick : Double(g.dpad.xAxis.value)
        let throttle = max(Double(g.rightTrigger.value), g.buttonA.isPressed ? 1 : 0) - max(Double(g.leftTrigger.value), g.buttonB.isPressed ? 1 : 0)
        if steer != 0 { pad.steer = steer }
        if throttle != 0 { pad.throttle = throttle }
        let use = g.buttonX.isPressed || g.rightShoulder.isPressed
        pad.fire = pad.fire || use
        pad.use = pad.use || use
    }
    return pad
}
