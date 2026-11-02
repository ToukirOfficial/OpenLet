// Point the app at the test database and a test key prefix before anything reads config().
try {
  process.loadEnvFile('../../.env');
} catch {
  // CI provides the variables directly.
}
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? 'postgresql://openlet:openlet@127.0.0.1:5432/openlet_test';
process.env['REDIS_URL'] ??= 'redis://127.0.0.1:6379/14';
process.env['REDIS_PREFIX'] = 'openlet-test';
process.env['STORAGE_DIR'] = './storage-test';
process.env['JWT_SECRET'] ??= 'test-secret-test-secret-test-secret-1234';
process.env['COOKIE_SECURE'] = 'false';
process.env['MAIL_TRANSPORT'] = 'log';
process.env['DEMO_MODE'] = 'false';
process.env['SIGNUP_ENABLED'] = 'false';
process.env['APP_URL'] = 'http://localhost:8030';
