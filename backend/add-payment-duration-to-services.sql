-- Add `payment_duration` to services (MySQL).
-- Use this in production environments where TypeORM `synchronize` is disabled.

ALTER TABLE `services`
  ADD COLUMN `payment_duration` ENUM('hourly','daily','weekly','monthly','each_time')
  NOT NULL
  DEFAULT 'each_time'
  AFTER `balance`;


