#!/bin/bash
# Subsidiary Site Scaffolding Script
# Reference: Master Plan Section 7 - Phase 8
# 
# Usage: ./scripts/subsidiary-sites/scaffold.sh <site-name> [--subdomain <subdomain>]
#
# Examples:
#   ./scripts/subsidiary-sites/scaffold.sh "BEIE" --subdomain "beie"
#   ./scripts/subsidiary-sites/scaffold.sh "Smart Cities" --subdomain "smart-cities"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEMPLATE_DIR="besbpo-subsidiary-site-template"
SUBSIDIARY_DIR="/workspace/project"
SITE_NAME=""
SUBDOMAIN=""
DESCRIPTION=""
DIVISION=""
LOCALE="en-ZA"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --subdomain)
            SUBDOMAIN="$2"
            shift 2
            ;;
        --description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --division)
            DIVISION="$2"
            shift 2
            ;;
        --locale)
            LOCALE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 <site-name> [--subdomain <subdomain>] [--description <desc>] [--division <division>] [--locale <locale>]"
            echo ""
            echo "Arguments:"
            echo "  site-name      The display name for the subsidiary site (e.g., 'BEIE', 'Smart Cities')"
            echo "  --subdomain    The subdomain for the site (e.g., 'beie', 'smart-cities')"
            echo "  --description  Short description of the subsidiary"
            echo "  --division     The BESBPO division this site belongs to"
            echo "  --locale       Locale code (default: en-ZA)"
            echo ""
            echo "Examples:"
            echo "  $0 'BEIE' --subdomain 'beie' --division 'built-environment'"
            echo "  $0 'Smart Cities' --subdomain 'smart-cities' --division 'smart-cities'"
            exit 0
            ;;
        *)
            if [ -z "$SITE_NAME" ]; then
                SITE_NAME="$1"
            else
                echo -e "${RED}Error: Unknown argument: $1${NC}"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [ -z "$SITE_NAME" ]; then
    echo -e "${RED}Error: Site name is required${NC}"
    echo "Usage: $0 <site-name> [--subdomain <subdomain>] [--description <desc>]"
    exit 1
fi

# Generate subdomain if not provided
if [ -z "$SUBDOMAIN" ]; then
    SUBDOMAIN=$(echo "$SITE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
fi

# Generate site slug from name
SITE_SLUG=$(echo "$SITE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

# Site directory
SITE_DIR="$SUBSIDIARY_DIR/besbpo-subsidiary-site-$SITE_SLUG"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  BESBPO Subsidiary Site Scaffolder${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Site Name:${NC}    $SITE_NAME"
echo -e "${GREEN}Subdomain:${NC}    $SUBDOMAIN.besbpo.co.za"
echo -e "${GREEN}Site Slug:${NC}    $SITE_SLUG"
echo -e "${GREEN}Directory:${NC}    $SITE_DIR"
echo ""

# Check if template exists
if [ ! -d "$SUBSIDIARY_DIR/$TEMPLATE_DIR" ]; then
    echo -e "${RED}Error: Template directory not found: $TEMPLATE_DIR${NC}"
    exit 1
fi

# Check if site already exists
if [ -d "$SITE_DIR" ]; then
    echo -e "${YELLOW}Warning: Site directory already exists: $SITE_DIR${NC}"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -rf "$SITE_DIR"
fi

# Create site directory
echo -e "${BLUE}Creating site directory...${NC}"
mkdir -p "$SITE_DIR"

# Copy template
echo -e "${BLUE}Copying template files...${NC}"
cp -r "$SUBSIDIARY_DIR/$TEMPLATE_DIR/"* "$SITE_DIR/"

# Replace placeholders
echo -e "${BLUE}Customizing site files...${NC}"

# Define replacements
declare -A REPLACEMENTS=(
    ["{{SITE_NAME}}"]="$SITE_NAME"
    ["{{SITE_SLUG}}"]="$SITE_SLUG"
    ["{{SUBDOMAIN}}"]="$SUBDOMAIN"
    ["{{DOMAIN}}"]="$SUBDOMAIN.besbpo.co.za"
    ["{{DESCRIPTION}}"]="${DESCRIPTION:-A BESBPO Group subsidiary website}"
    ["{{DIVISION}}"]="${DIVISION:-general}"
    ["{{LOCALE}}"]="$LOCALE"
)

# Apply replacements to all files
find "$SITE_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" \) | while read -r file; do
    for key in "${!REPLACEMENTS[@]}"; do
        value="${REPLACEMENTS[$key]}"
        sed -i "s|$key|$value|g" "$file"
    done
done

# Rename template-specific files
if [ -d "$SITE_DIR/template-site" ]; then
    mv "$SITE_DIR/template-site" "$SITE_DIR/$SITE_SLUG"
fi

# Update package.json name
if [ -f "$SITE_DIR/package.json" ]; then
    sed -i "s|\"name\": \".*\"|\"name\": \"besbpo-subsidiary-site-$SITE_SLUG\"|" "$SITE_DIR/package.json"
fi

# Update next.config.js
if [ -f "$SITE_DIR/next.config.js" ]; then
    sed -i "s|besbpo-template|$SITE_SLUG|g" "$SITE_DIR/next.config.js"
fi

# Create README
cat > "$SITE_DIR/README.md" << EOF
# $SITE_NAME - BESBPO Subsidiary Site

## Overview

This is a subsidiary site for **$SITE_NAME**, part of the BESBPO Group blog ecosystem.

## Details

| Field | Value |
|-------|-------|
| **Site Name** | $SITE_NAME |
| **Subdomain** | $SUBDOMAIN.besbpo.co.za |
| **Division** | ${DIVISION:-general} |
| **Locale** | $LOCALE |
| **Description** | ${DESCRIPTION:-A BESBPO Group subsidiary website} |

## Development

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Deployment

This site is deployed via the main BESBPO CI/CD pipeline. See the infrastructure documentation for details.

## Content Structure

- Articles are managed through the main CMS API
- Content is syndicated from the primary blog
- Custom styling can be applied in \`styles/globals.css\`

## License

Proprietary - BESBPO Group
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Site scaffolded successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. cd $SITE_DIR"
echo "  2. npm install"
echo "  3. npm run dev"
echo ""
