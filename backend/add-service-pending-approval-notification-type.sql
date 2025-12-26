-- Add 'service_pending_approval' to the notifications `type` enum (MySQL).
-- Use this in production environments where TypeORM `synchronize` is disabled.
--
-- IMPORTANT: MySQL requires redefining the entire ENUM list. If you've added more types,
-- update this list accordingly.

ALTER TABLE `notifications`
  MODIFY COLUMN `type` ENUM(
    'broadcast',
    'payment_charge',
    'payment_withdraw',
    'payment_transfer',
    'message',
    'service_pending_approval',
    'service_approved',
    'service_blocked',
    'service_unblocked',
    'milestone_created',
    'milestone_updated',
    'milestone_payment_pending'
  ) NOT NULL;


