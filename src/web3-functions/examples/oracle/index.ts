import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract, providers } from "ethers";
import ky from "ky"; // we recommend using ky as axios doesn't support fetch by default

const ORACLE_ABI = [
  "function lastUpdated() external view returns(uint256)",
  "function updatePrice(uint256)",
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, gelatoArgs/*, provider*/ } = context;

  const provider = new  providers.JsonRpcProvider("https://goerli.infura.io/v3/3b3638bd59184c8c85b9f312959ae615")
  // Retrieve Last oracle update time
  const oracleAddress =
    (userArgs.oracle as string) ?? "0x6a3c82330164822A8a39C7C0224D20DB35DD030a";
  let lastUpdated;
  let oracle;
  try {
    oracle = new Contract(oracleAddress, ORACLE_ABI, provider);
    //console.log(oracle)
    console.log(await oracle.lastUpdated())
    lastUpdated = parseInt(await oracle.lastUpdated());
    console.log(`Last oracle update: ${lastUpdated}`);
  } catch (err) {
    return { canExec: false, message: `Rpc call failed` };
  }

  // Check if it's ready for a new update
  const nextUpdateTime = lastUpdated + 3600; // 1h
  const timestamp = gelatoArgs.blockTime;
  console.log(`Next oracle update: ${nextUpdateTime}`);
  if (timestamp < nextUpdateTime) {
    //return { canExec: false, message: `Time not elapsed` };
  }

  // Get current price on coingecko
  const currency = (userArgs.currency as string) ?? "ethereum";
  let price = 0;
  try {
    const coingeckoApi = `https://api.coingecko.com/api/v3/simple/price?ids=${currency}&vs_currencies=usd`;

    const priceData: { [key: string]: { usd: number } } = await ky
      .get(coingeckoApi, { timeout: 5_000, retry: 0 })
      .json();
    price = Math.floor(priceData[currency].usd);
  } catch (err) {
    return { canExec: false, message: `Coingecko call failed` };
  }
  console.log(`Updating price: ${price}`);

  // Return execution call data
  return {
    canExec: true,
    callData: oracle.interface.encodeFunctionData("updatePrice", [price]),
  };
});
