-- Make service image optional (MySQL).
-- Use this in production environments where TypeORM `synchronize` is disabled.

ALTER TABLE `services`
  MODIFY COLUMN `ad_image` VARCHAR(255) NULL;


