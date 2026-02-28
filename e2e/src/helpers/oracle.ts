import {
  publicClient,
  sendDeployerTx,
  ADDRESSES,
  SimpleOracleABI,
  ETHUSD_FEED_ID,
} from "../setup.js";

/**
 * Set ETH/USD price on SimpleOracle via setPriceNow.
 * @param priceUSD -- price in dollars (e.g. 3000 for $3,000)
 */
export async function setETHPrice(priceUSD: number): Promise<void> {
  const priceWAD = BigInt(Math.round(priceUSD * 1e18));
  await sendDeployerTx({
    to: ADDRESSES.SIMPLE_ORACLE as `0x${string}`,
    abi: SimpleOracleABI,
    functionName: "setPriceNow",
    args: [ETHUSD_FEED_ID, priceWAD],
  });
}

/**
 * Read the current ETH/USD price from SimpleOracle.
 */
export async function getETHPrice(): Promise<{
  timestampNs: bigint;
  quantizedValue: bigint;
}> {
  const result = await publicClient.readContract({
    address: ADDRESSES.SIMPLE_ORACLE as `0x${string}`,
    abi: SimpleOracleABI,
    functionName: "getTemporalNumericValueV1",
    args: [ETHUSD_FEED_ID],
  });
  return {
    timestampNs: (result as any).timestampNs,
    quantizedValue: (result as any).quantizedValue,
  };
}
