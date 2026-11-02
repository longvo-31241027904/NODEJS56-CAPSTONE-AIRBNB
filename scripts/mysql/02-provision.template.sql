-- TEMPLATE ONLY: do not execute with placeholders.
-- First run 01-preflight.sql. Continue only for new names or confirmed project schemas.
-- Copy to an ignored *.local.sql file and replace both password placeholders there.
-- Prefer new random URL-safe passwords (at least 20 characters).
-- If using quotes/backslashes, escape them correctly for your session SQL mode.
-- Run in an administrator session. Stop on any error; do not use mysql --force.
-- Existing accounts cause CREATE USER to fail; NEVER reset their passwords here.
CREATE DATABASE IF NOT EXISTS airbnb_capstone_local
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS airbnb_capstone_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'airbnb_local_app'@'localhost' IDENTIFIED BY '<LOCAL_DB_PASSWORD>';
CREATE USER 'airbnb_test_app'@'localhost' IDENTIFIED BY '<TEST_DB_PASSWORD>';

-- Escape underscores so the database-level grants match only these names.
-- No global privilege, GRANT OPTION, DROP, or privilege on the other database.
-- DDL privileges below support the existing initial migration without shadow DB.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `airbnb\_capstone\_local`.* TO 'airbnb_local_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `airbnb\_capstone\_test`.* TO 'airbnb_test_app'@'localhost';

SHOW GRANTS FOR 'airbnb_local_app'@'localhost';
SHOW GRANTS FOR 'airbnb_test_app'@'localhost';
