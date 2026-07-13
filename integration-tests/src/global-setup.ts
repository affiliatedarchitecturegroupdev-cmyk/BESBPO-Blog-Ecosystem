// Global Setup for Integration Tests
// Reference: Master Plan Section 7

import { execSync } from 'child_process';
import { TestConfig, validateEnvironment } from './config.js';

export default async (): Promise<void> => {
  console.log('='.repeat(60));
  console.log('🔧 BESBPO Integration Test Suite');
  console.log('='.repeat(60));
  console.log();

  // Validate environment
  validateEnvironment();

  // Check if Docker is available
  console.log('🐳 Checking Docker...');
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker is available');
  } catch {
    console.warn('⚠️  Docker is not available - assuming services are running');
  }

  // Check if services are reachable
  console.log('\n🔍 Checking service availability...');
  const services = [
    { name: 'CMS API', url: TestConfig.services.cmsApi },
    { name: 'Syndication API', url: TestConfig.services.syndicationApi },
    { name: 'Intelligence API', url: TestConfig.services.intelligenceApi },
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url + '/health', {
        method: 'GET',
        timeout: 5000,
      });
      console.log(`✅ ${service.name}: ${service.url} (${response.status})`);
    } catch {
      console.warn(`⚠️  ${service.name}: ${service.url} (not reachable)`);
    }
  }

  console.log();
  console.log('✅ Global setup complete');
  console.log('='.repeat(60));
  console.log();
};
