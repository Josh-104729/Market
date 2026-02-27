ALTER TABLE services
ADD COLUMN approved_at TIMESTAMP NULL;

UPDATE services
SET approved_at = updated_at
WHERE status = 'active' AND approved_at IS NULL;

