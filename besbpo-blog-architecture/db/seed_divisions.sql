-- Seed data for the division taxonomy. Implements Doc-03 Section 5.
-- Extend/refine this list with Fortune during Phase 0 (Doc-05 Phase 0) once
-- the full mapping of 35+ named subsidiaries to these categories is finalised.

INSERT INTO divisions (key, label, description) VALUES
    ('built-environment',   'Built Environment',        'Multi-disciplinary architecture & engineering practices'),
    ('construction',        'Construction',             'Contracting, project delivery, site execution'),
    ('real-estate',         'Real Estate',               'Brokerage, asset management, leasing'),
    ('property-development','Property Development',      'Land development, mixed-use, residential/commercial schemes'),
    ('logistics',           'Logistics',                 'Fleet, freight, distribution'),
    ('last-mile-services',  'Last-Mile Services',        'Last-mile delivery technology and operations'),
    ('enterprise-software', 'Enterprise Software',       'Internal platforms, SaaS products, engineering'),
    ('bpo',                 'Business Process Outsourcing', 'BPO operations'),
    ('consultancy',         'Consultancy',                'Advisory, strategy, feasibility'),
    ('security-services',   'Security Services',          'Venue and event security, VIP protection, nightlife security operations'),
    ('corporate',           'Corporate',                  'Group-wide announcements, investor relations, culture')
ON CONFLICT (key) DO NOTHING;
