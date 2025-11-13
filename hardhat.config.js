require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("./tasks/deploy.js");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    horizenTestnet: {
      url: "https://horizen-testnet.rpc.caldera.xyz/http",
      accounts: process.env.HORIZEN_TESTNET_PRIVATE_KEY
        ? [process.env.HORIZEN_TESTNET_PRIVATE_KEY]
        : [],
    },
  },
};
