task("zkv:deploy", "Deploys a zkVerifyAttestation contract behind a UUPS proxy")
  .addParam("contractName", "Name of the contract to deploy")
  .addParam("args", "Arguments to pass to the contract constructor")
  .setAction(async (taskArgs, hre) => {
    await main(taskArgs.contractName, taskArgs.args);
  });

async function main(contractName, args) {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await upgrades.deployProxy(Contract, JSON.parse(args));
  await contract.waitForDeployment();
  console.log(contractName, "deployed to:", await contract.getAddress());
}
