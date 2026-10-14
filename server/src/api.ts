import type express from 'express';
import { TRACKS } from '../../shared/src/track.ts';
import { APP_STORE, MIN_PROTOCOL, PROTOCOL, type VersionInfo, compatible, protocolOf } from '../../shared/src/version.ts';

/**
 * What a client asks before it races online: whether it still may (`GET /version?protocol=2`), and which Tracks it can
 * pick (`GET /tracks`, every `TrackDef` the server races, in `TRACKS` order), so a Track added or changed here reaches the
 * apps without an update. Both are public and only change with a deploy. (Colyseus lets any origin read every route, which
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
}
