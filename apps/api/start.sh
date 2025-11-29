#!/bin/sh
# Startup wrapper script for LinkSmash API
# Verifies required files exist before starting the application

# Verify dist/main.js exists
if [ ! -f "dist/main.js" ]; then
  echo "ERROR: dist/main.js not found!" >&2
  exit 1
fi

# Start the application
exec node dist/main.js

