// Global Teardown for Integration Tests
// Reference: Master Plan Section 7

import { execSync } from 'child_process';

export default async (): Promise<void> => {
  console.log();
  console.log('='.repeat(60));
  console.log('🧹 Running Global Teardown');
  console.log('='.repeat(60));
  console.log();

  // Check if we should teardown Docker
  if (process.env.TEARDOWN_DOCKER !== 'false') {
    console.log('🐳 Stopping test containers...');
    try {
      execSync('docker-compose -f docker-compose.test.yml down -v', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      console.log('✅ Docker containers stopped');
    } catch {
      console.warn('⚠️  Could not stop Docker containers');
    }
  }

  console.log();
  console.log('✅ Global teardown complete');
  console.log('='.repeat(60));
};
