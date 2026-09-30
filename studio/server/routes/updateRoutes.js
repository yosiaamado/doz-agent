// One-click update: local status, manifest check, apply, and the user-overridable endpoint.
import { updateCheckBody, updateApplyBody, updateSettingsBody } from '../http/schemas.js';

export function registerUpdateRoutes(router, { update }) {
  router
    .get('/api/update/status', () => update.status())
    .post('/api/update/check', ({ body }) => update.check(updateCheckBody.parse(body ?? {})))
    .post('/api/update/apply', ({ body }) => update.apply(updateApplyBody.parse(body)))
    .get('/api/update/settings', () => update.getSettings())
    .put('/api/update/settings', ({ body }) => update.setSettings(updateSettingsBody.parse(body)));
}
