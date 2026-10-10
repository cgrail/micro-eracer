# Browsers drive their own E-Car; the server owns everything else

Each Player's browser simulates its own E-Car and reports its position to the server. The server simulates the Bots, Batteries, Item Boxes, Shots, Missiles and Mines, owns every E-Car's Energy, judges every Hit and Ram, and checks Checkpoints. It syncs this state to the browsers through Colyseus. We chose this so a Player's own car responds instantly, without building client-side prediction and reconciliation. The only cheating we guard against is shortcutting (Checkpoints checked on the server). Hacked clients are out of scope.

## Considered Options

- **Fully server-authoritative simulation**: rejected. It would need prediction and reconciliation to feel responsive, and protection against hacked clients was not a goal.
- **One Player's browser hosts the Race**: rejected. The Race would die when the host leaves.

## Consequences

- A modified browser can fake its own E-Car's position and speed. We accept this.
- Hits on Players are judged against slightly old positions, so on a bad connection some hits will look unfair.
- Each side resolves collisions only for the bodies it owns: a browser bounces its own E-Car off the others, and the server bounces Bots off Players. Only the server moves Energy.
- The same physics (Rapier) and car tuning run in the browser and in Node, as shared TypeScript.
- Because of the Offline Race, everything the server owns (Bots, Energy, Hits, Items) must also live in shared code that can run in the browser.
- Races map onto Colyseus rooms. That locks us into Colyseus's room and state-sync model.
