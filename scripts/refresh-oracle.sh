#!/bin/bash
# refresh-oracle.sh -- Keeps the SimpleOracle ETHUSD price fresh for demos
#
# The Chariot protocol has a 3600s oracle staleness threshold. If the oracle
# price goes stale, borrows will revert and the dashboard may show errors.
# Run this script in the background before a demo to refresh every 30 minutes.
#
# Usage:
#   cd chariot && bash scripts/refresh-oracle.sh &
#
# Requirements:
#   - Foundry (cast) installed: https://book.getfoundry.sh/getting-started/installation
#   - DEPLOYER_PRIVATE_KEY set in contracts/.env

set -euo pipefail

# Load env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../contracts/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: contracts/.env not found at $ENV_FILE"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "ERROR: DEPLOYER_PRIVATE_KEY not set in contracts/.env"
  exit 1
fi

# Contract addresses
ORACLE="0xef2eD9f23E7dc480c7be7C59Fa5D50C7C901e178"
RPC="https://rpc.blockdaemon.testnet.arc.network"

# ETHUSD feed ID
FEED_ID="0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160"

# ETH price: $2,500 in 18-decimal WAD (int192)
PRICE="2500000000000000000000"

# Refresh interval: 30 minutes (1800 seconds)
INTERVAL=1800

echo "Oracle refresh daemon started"
echo "  Oracle:   $ORACLE"
echo "  Feed:     ETHUSD"
echo "  Price:    \$2,500"
echo "  Interval: ${INTERVAL}s (30 min)"
echo "  RPC:      $RPC"
echo ""

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo -n "[$TIMESTAMP] Refreshing ETHUSD price..."

  if cast send "$ORACLE" \
    "setPriceNow(bytes32,int192)" \
    "$FEED_ID" \
    "$PRICE" \
    --rpc-url "$RPC" \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    --quiet 2>/dev/null; then
    echo " OK"
  else
    echo " FAILED (will retry next interval)"
  fi

  sleep "$INTERVAL"
done
