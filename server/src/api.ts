import { matchMaker } from '@colyseus/core';
import type express from 'express';
import type { RunningRace } from '../../shared/src/snapshot.ts';
import { TRACKS } from '../../shared/src/track.ts';
import { APP_STORE, MIN_PROTOCOL, PROTOCOL, type VersionInfo, compatible, protocolOf } from '../../shared/src/version.ts';

/**
 * What a client asks before it races online: whether it still may (`GET /version?protocol=2`), which Tracks it can pick
 * (`GET /tracks`, every `TrackDef` the server races, in `TRACKS` order), so a Track added or changed here reaches the apps
 * without an update, and the Race it would join (`GET /race`). All three are public; the first two only change with a deploy. (Colyseus lets any origin read every route, which
 * development needs: the browser game comes from Vite's port there and asks this one.)
 */
export function api(app: express.Application) {
  app.get('/version', (req, res) => {
    // the app's page on the App Store, for the update dialog's button (another one can be set in the service's settings, like DOMAIN)
    const update = process.env.APP_STORE_URL || APP_STORE;
    const info: VersionInfo = { protocol: PROTOCOL, minProtocol: MIN_PROTOCOL, compatible: compatible(protocolOf(req.query.protocol)), update };
    res.set('Cache-Control', 'no-cache').json(info);
  });
  app.get('/tracks', (_req, res) => {
    res.set('Cache-Control', 'no-cache').json(TRACKS);
  });
  // the Race a join takes (the fullest with a free Seat, as `race2` matches) with its Track, which the start screen shows in
  // place of the picker; `{}` while none is running, and the next Player picks the Track
  app.get('/race', async (_req, res) => {
    const [room] = await matchMaker.query({ name: 'race2', locked: false, private: false }, { clients: -1 });
    const track = TRACKS.find((t) => t.id === room?.metadata?.track);
    const race: RunningRace | {} = track ? { track, players: room.metadata.players ?? [] } : {};
    res.set('Cache-Control', 'no-store').json(race);
  });
}
