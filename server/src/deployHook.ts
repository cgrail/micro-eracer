import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * GitHub's push webhook, so a merge to main deploys at once instead of at the update timer's
 * next tick (which stays as the fallback). The server runs unprivileged, so all it does is
 * touch a file in its runtime directory: install.sh's systemd path unit watches that file and
 * starts update.sh, which fetches origin/main itself and so never trusts the payload.
 * It is on only when DEPLOY_HOOK_SECRET (the webhook's secret) is set and systemd gave the
 * service a RUNTIME_DIRECTORY, i.e. in production.
 */
export function deployHook(app: express.Application) {
  const secret = process.env.DEPLOY_HOOK_SECRET, dir = process.env.RUNTIME_DIRECTORY;
  if (!secret || !dir) return;
  app.post('/deploy-hook', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
    const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const sent = Buffer.from(req.get('x-hub-signature-256') ?? '');
    const want = Buffer.from('sha256=' + createHmac('sha256', secret).update(body).digest('hex'));
    if (sent.length !== want.length || !timingSafeEqual(sent, want)) { res.status(401).send('bad signature\n'); return; }
    const event = req.get('x-github-event');
    if (event === 'ping') { res.send('pong\n'); return; }
    let push: { ref?: unknown; after?: unknown };
    try {
      // GitHub sends JSON, or the same JSON in a form field when the webhook's content type is form-encoded
      const text = body.toString();
      push = JSON.parse(req.is('urlencoded') ? new URLSearchParams(text).get('payload') ?? '' : text);
    } catch { res.status(400).send('bad payload\n'); return; }
    // update.sh deploys main, so pushes to other branches change nothing
    if (event !== 'push' || push?.ref !== 'refs/heads/main') { res.status(202).send('ignored\n'); return; }
    const rev = typeof push.after === 'string' && /^[0-9a-f]{40}$/.test(push.after) ? push.after : 'unknown';
    try {
      await writeFile(join(dir, 'deploy'), `${rev}\n`);
    } catch (err) {
      console.error('deploy hook: cannot request a deploy', err);
      res.status(500).send('cannot request a deploy\n');
      return;
    }
    console.log(`deploy hook: main is at ${rev}, deploying`);
    res.status(202).send('deploying\n');
  });
  console.log('deploy hook on POST /deploy-hook');
}
