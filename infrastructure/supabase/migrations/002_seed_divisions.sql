-- Migration: 002_seed_divisions
-- Description: Seeds initial division taxonomy data
-- Reference: Master Plan Section 5, BESBPO-BLOG-ARCH-03

BEGIN;

-- Seed divisions from taxonomy
INSERT INTO divisions (id, key, label, description) VALUES
    ('a1b2c3d4-0001-0000-0000-000000000001', 'built-environment', 'Built Environment', 'Infrastructure, construction, and urban development'),
    ('a1b2c3d4-0002-0000-0000-000000000001', 'smart-cities', 'Smart Cities', 'Technology-driven urban solutions and IoT'),
    ('a1b2c3d4-0003-0000-0000-000000000001', 'sustainability', 'Sustainability', 'Green building, ESG, and environmental impact'),
    ('a1b2c3d4-0004-0000-0000-000000000001', 'infrastructure', 'Infrastructure', 'Roads, bridges, utilities, and public facilities'),
    ('a1b2c3d4-0005-0000-0000-000000000001', 'architecture', 'Architecture', 'Design, planning, and architectural trends'),
    ('a1b2c3d4-0006-0000-0000-000000000001', 'energy', 'Energy', 'Renewable energy, utilities, and power infrastructure'),
    ('a1b2c3d4-0007-0000-0000-000000000001', 'water-waste', 'Water & Waste', 'Water management, wastewater, and waste solutions'),
    ('a1b2c3d4-0008-0000-0000-000000000001', 'transportation', 'Transportation', 'Roads, rail, ports, and logistics'),
    ('a1b2c3d4-0009-0000-0000-000000000001', 'housing', 'Housing', 'Residential development and affordable housing'),
    ('a1b2c3d4-000a-0000-0000-000000000001', 'healthcare-facilities', 'Healthcare Facilities', 'Hospital and medical infrastructure'),
    ('a1b2c3d4-000b-0000-0000-000000000001', 'education-facilities', 'Education Facilities', 'Schools, universities, and training centers'),
    ('a1b2c3d4-000c-0000-0000-000000000001', 'corporate-real-estate', 'Corporate Real Estate', 'Commercial property and office infrastructure'),
    ('a1b2c3d4-000d-0000-0000-000000000001', 'investment-finance', 'Investment & Finance', 'Project financing, PPPs, and investment trends');

-- Seed initial tags
INSERT INTO tags (name) VALUES
    ('innovation'),
    ('sustainability'),
    ('technology'),
    ('policy'),
    ('investment'),
    ('urbanization'),
    ('resilience'),
    ('efficiency'),
    ('digitalization'),
    ('green-building');

COMMIT;
