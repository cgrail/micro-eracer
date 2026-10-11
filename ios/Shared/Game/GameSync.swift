import SceneKit

// The state sync of client/src/game.ts: the room's state (or the Offline Race's) into the scene.
extension Game {
    func loadTrack(_ id: String) {
        for v in views.compactMap({ $0 }) { v.model.node.removeFromParentNode(); v.drone.removeFromParentNode() }
        views = [CarView?](repeating: nil, count: SEATS)
        for n in batteries.values.map(\.node) + mines.values.map(\.node) + bolts.values.map(\.node) + boxes { n.removeFromParentNode() }
        batteries = [:]; mines = [:]; bolts = [:]
        own = nil
        look?.node.removeFromParentNode()
        let def = TRACKS.first { $0.id == id } ?? TRACKS[0], track = buildTrack(def)
        self.track = track
        // every Track has its own song
        sound.music(TRACKS.firstIndex { $0.id == def.id } ?? 0)
        world = createTrackWorld(track)
        let look = buildTrackScene(track)
        self.look = look
        scene.rootNode.addChildNode(look.node)
        scene.background.contents = look.sky
        scene.fogColor = look.horizon
        boxes = track.itemBoxes.map { b in
            let box = makeItemBox()
            box.position = SCNVector3(b.x, b.y + 0.8, b.z)
            scene.rootNode.addChildNode(box)
            return box
        }
    }

    func onState(_ s: RaceState) {
        state = s
        if s.trackId != track?.def.id { loadTrack(s.trackId) }
        for (i, c) in s.cars.enumerated() where i < SEATS { syncCar(c, i) }
        syncSpots(s.batteries)
        syncMines(s.mines)
        syncBolts(s.bolts)
        // the top three never see an Item Box: goodies are for those behind
        for (i, on) in s.boxes.enumerated() where i < boxes.count { boxes[i].isHidden = !(on && (me?.position ?? 0) >= GOODIES_FROM) }
    }

    private func syncCar(_ c: CarState, _ i: Int) {
        guard let world, let track else { return }
        let mine = c.owner == link.sessionId
        let pose = Pose(x: c.x, y: c.y, z: c.z, yaw: c.yaw)
        var v: CarView
        if let known = views[i], known.kind == c.body, known.mine == mine { v = known } else {
            if let old = views[i] { old.model.node.removeFromParentNode(); old.drone.removeFromParentNode(); world.remove(old.car.rb) }
            let model = makeCar(c.body, SEAT_COLORS[i]), tag = makeNameTag(c.name, human: !c.owner.isEmpty), drone = makeDrone()
            model.node.addChildNode(tag)
            drone.node.isHidden = true
            scene.rootNode.addChildNode(model.node)
            scene.rootNode.addChildNode(drone.node)
            v = CarView(model: model, drone: drone, tag: tag, c: c, mine: mine, car: createCar(world, c.body, pose, mine), now: now)
            views[i] = v
            if mine { own = Own(view: v, seat: i, progress: startProgress(track, 0)) }
        }
        if v.name != c.name {
            v.tag.removeFromParentNode()
            v.tag = makeNameTag(c.name, human: !c.owner.isEmpty)
            v.model.node.addChildNode(v.tag)
            v.name = c.name
        }
        if v.mode != c.mode { v.prevMode = v.mode; v.mode = c.mode; v.modeSince = now }
        v.energy = c.energy
        v.model.shield.isHidden = !c.shield
        guard mine, let own else { v.target = (c.x, c.y, c.z, c.yaw, c.vx, c.vz, now); return }
        // Battery pickups, Rams and Hits show up as jumps; driving drains too slowly to trigger this
        let gained = me != nil && c.mode == DRIVING && me!.mode == DRIVING ? c.energy - me!.energy : 0
        if abs(gained) > 4 { feed.popup("\(gained > 0 ? "+" : "")\(gained)", gain: gained > 0, now) }
        if let me, !me.finished && c.finished { sound.fanfare() }
        me = c
        if own.spawn != c.spawn {
            // the race moved our E-Car (new Race grid, or we just took over a Bot)
            teleport(v.car, pose, c.vx, c.vz)
            own.spawn = c.spawn
            own.progress = startProgress(track, nearestSample(track, c.x, c.y, c.z))
        }
    }

    private func syncSpots(_ list: [Spot]) {
        let seen = Set(list.map(\.id))
        for b in list where batteries[b.id] == nil {
            let node = makeBattery()
            node.position = SCNVector3(b.x, b.y + 1.1, b.z)
            batteries[b.id] = (node, b.y + 1.1)
            scene.rootNode.addChildNode(node)
        }
        for (id, b) in batteries where !seen.contains(id) {
            let p = b.node.position
            for _ in 0..<18 { sparks.emit(Double(p.x), Double(p.y), Double(p.z), .random(in: -4..<4), .random(in: 0..<7), .random(in: -4..<4), 0.5, 0.6) }
            b.node.removeFromParentNode()
            batteries[id] = nil
        }
    }

    private func syncMines(_ list: [Spot]) {
        let seen = Set(list.map(\.id))
        for m in list where mines[m.id] == nil {
            let mine = makeMine()
            mine.node.position = SCNVector3(m.x, m.y, m.z)
            mines[m.id] = mine
            scene.rootNode.addChildNode(mine.node)
        }
        for (id, m) in mines where !seen.contains(id) { m.node.removeFromParentNode(); mines[id] = nil }
    }

    private func syncBolts(_ list: [BoltState]) {
        let seen = Set(list.map(\.id))
        for b in list {
            if bolts[b.id] != nil { bolts[b.id]!.s = b; bolts[b.id]!.at = now; continue }
            let node = makeBolt(b.kind)
            node.position = SCNVector3(b.x, b.y + 0.45, b.z)
            scene.rootNode.addChildNode(node)
            bolts[b.id] = (node, b, now)
        }
        for (id, b) in bolts where !seen.contains(id) { b.node.removeFromParentNode(); bolts[id] = nil }
    }
}
