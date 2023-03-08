import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { Contract, providers, utils } from "ethers";
import axios from "axios";
import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide } from "paraswap-core";


const AUTOBUY_ABI = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amtUSDC","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amtGHST","type":"uint256"}],"name":"Buyback","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"inputs":[],"name":"buyAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"txData","type":"bytes"}],"name":"buyGHST","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"buyInterval","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"canBuy","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"contractOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getNextBuy","outputs":[{"internalType":"uint256","name":"_nextBuy","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ghstAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"lastBuyTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"paraswapAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"_setPause","type":"bool"}],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_buyAmount","type":"uint256"}],"name":"setBuyAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_buyInterval","type":"uint256"}],"name":"setBuyInterval","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_ghstAddress","type":"address"}],"name":"setGHSTAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_paraswapAddress","type":"address"}],"name":"setParaswapAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_slippage","type":"uint256"}],"name":"setSlippage","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_usdcAddress","type":"address"}],"name":"setUSDCAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slippage","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalGHSTBought","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalUSDCSpent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"usdcAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"usdcGHSTOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"erc20Tokens","type":"address[]"}],"name":"withdrawBalances","outputs":[],"stateMutability":"nonpayable","type":"function"}]

//check when next update

//if sufficient time has passed, get transaction data from paraswap

/////////////////////////////////////////////////////////////////
// Below code from:                                            //
//  https://developers.paraswap.network/api/examples           //
/////////////////////////////////////////////////////////////////
const API_URL = "https://apiv5.paraswap.io";

const BUYBACK_ADDRESS = "0xc9759f3E3ac8AF38BF75e052F8F6c060000281C7";

const PARTNER = "";

enum Networks {
  POLYGON = 137
}

interface MinTokenData {
  decimals: number;
  symbol: string;
  address: string;
}

const tokens: Record<number, MinTokenData[]> = {
  [Networks.POLYGON]: [
    {
      decimals: 18,
      symbol: "GHST",
      address: "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7"
    },
    {
      decimals: 6,
      symbol: "USDC",
      address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    }
  ]
};

function getToken(symbol: Symbol, networkID = Networks.MAINNET): MinTokenData {
  const token = tokens[networkID]?.find((t) => t.symbol === symbol);

  if (!token)
    throw new Error(`Token ${symbol} not available on network ${networkID}`);
  return token;
}

/**
 * @type ethereum address
 */
type Address = string;
/**
 * @type Token symbol
 */
type Symbol = string;
/**
 * @type number as string
 */
type NumberAsString = string;

interface TransactionParams {
  to: Address;
  from: Address;
  value: NumberAsString;
  data: string;
  gasPrice: NumberAsString;
  gas?: NumberAsString;
  chainId: number;
}

interface Swapper {
  getRate(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    partner?: string;
  }): Promise<OptimalRate>;
  buildSwap(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    minAmount: NumberAsString;
    priceRoute: OptimalRate;
    userAddress: Address;
    receiver?: Address;
    partner?: string;
  }): Promise<TransactionParams>;
}

function createSwapper(networkID: number, apiURL: string): Swapper {
  type PriceQueryParams = {
    srcToken: string;
    destToken: string;
    srcDecimals: string;
    destDecimals: string;
    amount: string;
    side: SwapSide;
    network: string;
    partner: string;
  };

  const getRate: Swapper["getRate"] = async ({
    srcToken,
    destToken,
    srcAmount,
    partner = PARTNER
  }) => {
    const queryParams: PriceQueryParams = {
      srcToken: srcToken.address,
      destToken: destToken.address,
      srcDecimals: srcToken.decimals.toString(),
      destDecimals: destToken.decimals.toString(),
      amount: srcAmount,
      side: SwapSide.SELL,
      network: networkID.toString(),
      partner
    };

    const searchString = new URLSearchParams(queryParams);

    const pricesURL = `${apiURL}/prices/?${searchString}`;
    console.log("GET /price URL", pricesURL);

    const {
      data: { priceRoute }
    } = await axios.get<{ priceRoute: OptimalRate }>(pricesURL);

    return priceRoute;
  };

  interface BuildTxBody {
    srcToken: Address;
    destToken: Address;
    srcAmount: NumberAsString;
    destAmount: NumberAsString;
    priceRoute: OptimalRate;
    userAddress: Address;
    partner?: string;
    receiver?: Address;
    srcDecimals?: number;
    destDecimals?: number;
  }

  const buildSwap: Swapper["buildSwap"] = async ({
    srcToken,
    destToken,
    srcAmount,
    minAmount,
    priceRoute,
    userAddress,
    receiver,
    partner
  }) => {
    const txURL = `${apiURL}/transactions/${networkID}`;

    const txConfig: BuildTxBody = {
      priceRoute,
      srcToken: srcToken.address,
      srcDecimals: srcToken.decimals,
      destToken: destToken.address,
      destDecimals: destToken.decimals,
      srcAmount,
      destAmount: minAmount,
      userAddress,
      partner,
      receiver
    };
    const { data } = await axios.post<TransactionParams>(txURL, txConfig);

    return data;
  };

  return { getRate, buildSwap };
}

interface GetSwapTxInput {
  srcToken: Symbol;
  destToken: Symbol;
  srcAmount: NumberAsString; // in srcToken denomination
  networkID: number;
  slippage?: number;
  partner?: string;
  userAddress: Address;
  receiver?: Address;
}

async function getSwapTransaction({
  srcToken: srcTokenSymbol,
  destToken: destTokenSymbol,
  srcAmount: _srcAmount,
  networkID,
  slippage,
  ...rest
}: GetSwapTxInput): Promise<TransactionParams> {
  try {
    const srcToken = getToken(srcTokenSymbol, networkID);
    const destToken = getToken(destTokenSymbol, networkID);

    const srcAmount = new BigNumber(_srcAmount)
      .times(10 ** srcToken.decimals)
      .toFixed(0);
    const ps = createSwapper(networkID, API_URL);
    const priceRoute = await ps.getRate({
      srcToken,
      destToken,
      srcAmount
    });
    const minAmount = new BigNumber(priceRoute.destAmount)
      .times(1 - slippage / 100)
      .toFixed(0);
    const transactionRequest = await ps.buildSwap({
      srcToken,
      destToken,
      srcAmount,
      minAmount,
      priceRoute,
      ...rest
    });

    return transactionRequest;
  } catch (error) {
    console.error(error.response.data);
    throw new Error(error.response.data.error);
  }
}

/////////////////////////////////////////////////////////////
//      the .onRun function is run by Gelato nodes         //
/////////////////////////////////////////////////////////////

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, gelatoArgs/*, provider */} = context;

    const provider = new providers.JsonRpcProvider("https://polygon-mainnet.infura.io/v3/d251f095b0d3483fa507ed5f3d0629f5")

  let buybackContract;
  let mySlippage;
  let buybackAmount;
  let canBuy;

  //get all the needed variables from our smart contract which we'll use to pass to Paraswap API
  try{
    buybackContract = new Contract(BUYBACK_ADDRESS, AUTOBUY_ABI, provider);
    mySlippage = await buybackContract.slippage();
    buybackAmount = await buybackContract.buyAmount();
    canBuy = await buybackContract.canBuy();
    if(!canBuy){
        return { canExec: false, message: `Buyback period has not elapsed`};
    }
  }catch(err){
    return { canExec: false, message: `RPC call failed` };
  }

  let tx;
  try{
    tx = await getSwapTransaction({
        srcAmount: utils.formatUnits(buybackAmount.toString(), 6),
        srcToken: "USDC",
        destToken: "GHST",
        networkID: Networks.POLYGON,
        slippage: mySlippage.toString(),
        userAddress: BUYBACK_ADDRESS
      });
  }catch(err){
    return { canExec: false, message: `Paraswap API calls failed`}
  }

  // Return execution call data
  return {
    canExec: true,
    callData: tx.data,
  };
});
