import SceneKit

// The events and effects of client/src/game.ts: sounds, sparks and shoves for what happened, and everything that moves by itself.
extension Game {
    private func rnd(_ spread: Double) -> Double { .random(in: -spread / 2..<spread / 2) }

    func explode(_ x: Double, _ z: Double) {
        for _ in 0..<40 { fire.emit(x, 0.8, z, rnd(12), .random(in: 0..<9), rnd(12), 0.8 + .random(in: 0..<0.6), 0.6) }
        for _ in 0..<14 { soot.emit(x + rnd(2), 1, z + rnd(2), rnd(2), 1 + .random(in: 0..<2), rnd(2), 1.2, 1.2) }
    }

    func onEvent(_ e: RaceEvent) {
        let mySeat = own?.seat ?? -1
        let vol = { (s: Int) -> Double in let p = self.posOf(s); return s == mySeat ? 1 : self.near(Double(p.x), Double(p.z)) }
        switch e {
        case let .ram(a, b, _, ix, iz, spin):
            let p = posOf(b), v = a == mySeat || b == mySeat ? 1 : near(Double(p.x), Double(p.z))
            sound.crash(v)
            sound.cry(.hurt, b, v)
            sound.cry(.gloat, a, v, delay: 0.35)
            for _ in 0..<12 { sparks.emit(Double(p.x), 0.8, Double(p.z), rnd(10), .random(in: 0..<6), rnd(10), 0.35, 0.4) }
            if b == mySeat, let own {
                // we drive our own E-Car, so we apply the shove the server worked out
                shove(own.view.car, ix, iz, spin)
                shake = 0.35
            } else if b >= 0 && b < views.count, let victim = views[b], now - victim.kickedAt > 0.5 {
                // the shoved E-Car starts sliding at once, before the server's next update shows it (unless we shoved it already)
                victim.target.vx += ix
                victim.target.vz += iz
            }
        case let .hit(s, by, kind, ix, iz, hop, spin):
            let p = posOf(s), mine = s == mySeat
            if kind != .shot {
                sound.cry(.thrown, s, vol(s))
                sound.cry(.gloat, by, vol(by), delay: 0.6)
            }
            if mine, let own {
                // we drive our own E-Car, so we apply the shove the server worked out
                let v = own.view.car.rb.linvel
                own.view.car.rb.linvel = Vec3(x: v.x + ix, y: v.y + hop, z: v.z + iz)
                own.view.car.spin = spin
                shake = kind == .shot ? 0.15 : 0.5
            }
            if kind == .shot { for _ in 0..<8 { sparks.emit(Double(p.x), 0.9, Double(p.z), rnd(6), .random(in: 0..<4), rnd(6), 0.3, 0.3) } }
        case let .boom(x, z):
            explode(x, z)
            sound.boom(near(x, z))
        case let .block(s): sound.block(vol(s))
        case let .battery(s): sound.battery(s == mySeat ? 1 : vol(s) * 0.4)
        case let .shot(s): sound.shot(vol(s))
        case let .item(s, item):
            if item == .missile { sound.missile(vol(s)) } else if item == .mine { sound.mineDrop(vol(s)) } else if s == mySeat { sound.shield() }
        case let .box(s, _):
            if s == mySeat { sound.box(); feed.roulette(now) }
        case let .stranded(s):
            if s == mySeat { sound.powerDown() }
            sound.cry(.despair, s, vol(s), delay: 0.3)
        case let .recharge(s): if s == mySeat { sound.battery() }
        case let .join(_, name, was): feed.announce("\(name) took over \(was)!", now)
        case let .leave(_, name, was): feed.announce("\(was) left, \(name) takes over", now)
        }
    }

    /// Splashes, drift smoke, spinning wheels, warning lights, drones, Batteries, Item Boxes and flying weapons.
    func animate(_ dt: Double, _ time: Double) {
        guard let track, let look else { return }
        var ownDrone = false
        for v in views.compactMap({ $0 }) {
            let p = v.model.node.position, px = Double(p.x), py = Double(p.y), pz = Double(p.z)
            let vel = v.mine ? (x: v.car.rb.vx, z: v.car.rb.vz) : (x: v.target.vx, z: v.target.vz)
            let speed = hypot(vel.x, vel.z), fx = sin(v.yaw), fz = cos(v.yaw), r = right(fx, fz)
            let forward = vel.x * fx + vel.z * fz, sideways = vel.x * r.x + vel.z * r.z
            for w in v.model.wheels { w.simdLocalRotate(by: simd_quatf(angle: Float(-forward * dt / 0.44), axis: [0, 1, 0])) }
            let wet = inPuddle(track, px, py, pz)
            if speed > 3 && wet {
                for _ in 0..<Int((speed / 5).rounded(.up)) {
                    splash.emit(px + rnd(2), v.roadY + 0.2, pz + rnd(2), rnd(5) + vel.x * 0.3, 3 + .random(in: 0..<5), rnd(5) + vel.z * 0.3, 0.35 + .random(in: 0..<0.3), 0.7)
                }
                if !v.wet { sound.splash(v.mine ? 1 : near(px, pz)) }
            }
            v.wet = wet
            if abs(sideways) > 3.5 && py > v.roadY - 0.2 { smoke.emit(px - fx * 1.6 + rnd(1), v.roadY + 0.1, pz - fz * 1.6 + rnd(1), 0, 0.5, 0, 0.7, 0.8) }
            if look.water && v.lastY > look.groundY && py <= look.groundY {
                for _ in 0..<50 { splash.emit(px, look.groundY, pz, rnd(9), 5 + .random(in: 0..<8), rnd(9), 0.5 + .random(in: 0..<0.5), 1) }
                sound.splash(v.mine ? 1.5 : near(px, pz))
            }
            v.lastY = py
            let flying = dronePose(v, time, now, soot: soot, sparks: sparks)
            if v.mine { ownDrone = flying }
            // red roof light: slow below a quarter of the Energy, fast when nearly or completely empty
            let low = v.energy < 25 || v.mode == STRANDED, urgent = v.energy < 10 || v.mode == STRANDED
            v.model.beacon.isHidden = !(low && v.mode != RECHARGE)
            v.model.halo.isHidden = Int(time * (urgent ? 8 : 4)) % 2 != 0
        }
        if let own, let me {
            let rb = own.view.car.rb, r = right(sin(rb.yaw), cos(rb.yaw))
            let driving = me.mode == DRIVING && state?.phase != .grid
            sound.drive(driving ? hypot(rb.vx, rb.vz) : 0, driving ? controls.drive().throttle : 0,
                        driving && rb.y > own.view.roadY - 0.2 ? (abs(rb.vx * r.x + rb.vz * r.z) - 3) / 4 : 0)
            sound.setDrone(ownDrone)
            if driving && me.energy < 25 && time > nextBeep {
                sound.lowBattery(me.energy < 10)
                nextBeep = time + (me.energy < 10 ? 0.35 : 0.8)
            }
        }
        for (id, b) in batteries {
            b.node.eulerAngles.y = Float(time * 2)
            b.node.position.y = Float(b.baseY + sin(time * 3 + Double(id)) * 0.25)
        }
        for (i, b) in boxes.enumerated() {
            let k = Double(i)
            b.eulerAngles = SCNVector3(sin(time + k) * 0.3, time * 1.5 + k, 0)
            b.position.y = Float(Double(track.itemBoxes[i].y) + 0.8 + sin(time * 2 + k) * 0.2)
        }
        for m in mines.values { m.light.diffuse.contents = color(Int(time * 3) % 2 == 1 ? 0xff2020 : 0x441111) }
        for b in bolts.values {
            let age = min(now - b.at, 0.2)
            b.node.position = SCNVector3(b.s.x + b.s.vx * age, b.s.y + 0.45, b.s.z + b.s.vz * age)
            b.node.eulerAngles.y = Float(atan2(b.s.vx, b.s.vz))
            if b.s.kind == "missile" { smoke.emit(b.s.x + b.s.vx * age, b.s.y + 0.45, b.s.z + b.s.vz * age, 0, 0.3, 0, 0.5, 0.5) }
        }
    }
}
