-- Link an n8n automation to the WebhookRegistration that routes events to
-- its n8n-hosted webhook trigger. The registration is created on deploy and
-- kept in sync on update/delete; SET NULL on delete so automations survive
-- a manual registration cleanup (they'll be re-linked on next deploy).

ALTER TABLE n8n_automations
  ADD COLUMN linked_registration_id TEXT
  REFERENCES webhook_registrations(id) ON DELETE SET NULL;
