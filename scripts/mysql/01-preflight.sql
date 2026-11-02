-- READ-ONLY. Run in your own administrator session on 127.0.0.1:3306.
-- Only inspect the two project names and proposed project accounts.
SELECT VERSION() AS server_version, @@port AS server_port, CURRENT_USER() AS authenticated_account;
SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME IN ('airbnb_capstone_local', 'airbnb_capstone_test');
SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA IN ('airbnb_capstone_local', 'airbnb_capstone_test')
ORDER BY TABLE_SCHEMA, TABLE_NAME;
SELECT User, Host FROM mysql.user
WHERE User IN ('airbnb_local_app', 'airbnb_test_app');
-- If either schema/account exists, STOP and establish that it belongs to this
-- project before running 02-provision.template.sql. Do not reset or delete it.
