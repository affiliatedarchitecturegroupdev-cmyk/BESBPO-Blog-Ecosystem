#!/bin/bash
# Smoke test for BESBPO Blog Platform

set -e

echo "Running smoke tests..."

# Test CMS API
echo "Testing CMS API..."
cd besbpo-blog-cms-api
npm run build
npm test
cd ..

# Test Blog Web
echo "Testing Blog Web..."
cd besbpo-blog-web
npm run build
cd ..

# Test Editorial Dashboard
echo "Testing Editorial Dashboard..."
cd bespbo-editorial-dashboard
npm run build
cd ..

echo "All smoke tests passed!"
