#!/bin/bash
# Revert all FMHY features to safe mode
# Run: bash scripts/revert-features.sh

FEATURE_FILE="src/lib/config/features.ts"

echo "Reverting ALL FMHY features to SAFE MODE..."

# Set all features to false
sed -i '' 's/\([A-Z_]*\): true/\1: false/g' "$FEATURE_FILE"

echo "All features disabled."
echo "  - Site now runs original code paths only"
echo "  - No new API calls will be made"
echo "  - Deploy this commit to instantly revert"
echo ""
echo "  To re-enable features later, flip them back"
echo "  in $FEATURE_FILE or use /admin/features"
