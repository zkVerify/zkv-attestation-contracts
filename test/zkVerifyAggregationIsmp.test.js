const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZkVerifyAggregationIsmp contract", function () {
    let ZkVerifyAggregationIsmp;
    let ZkVerifyAggregationIsmpProxy;
    let verifierInstance;
    let proxyInstance;

    let mockFeeToken;
    let dispatcherContract;

    const domainId = 1n;
    const initialAggregationId = 1n;

    let owner, operator, upgrader, addr1, addr2, ismpHost, relayerAddress, addrs, dispatcherSigner;

    let upgraderRole = ethers.solidityPackedKeccak256(["string"], ["UPGRADER_ROLE"]);
    let operatorRole = ethers.solidityPackedKeccak256(["string"], ["OPERATOR"]);
    let ownerRole = ethers.encodeBytes32String("");

    let minSubstrateTree = {
        root: "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
        leaves: [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
        ],
        proofs: [],
    };

    let substrateTree = {
        root: "0xd2297c32eeb9a5378d85368ed029315498d1b40d9b03e9ad93bee97a382b47c8",
        leaves: [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000003",
            "0x0000000000000000000000000000000000000000000000000000000000000004",
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x0000000000000000000000000000000000000000000000000000000000000006",
            "0x0000000000000000000000000000000000000000000000000000000000000007",
        ],
        proofs: [
            [
                "0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace",
                "0x4a008209643838d588e1e3949a8a49c2dc4dfb50ee6aab985a7cf6eccba95084",
                "0xc7bd4d69c8648fe845b6e254ee355bdee759904dde840623da4d218300cb6e89",
            ],
            [
                "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
                "0x4a008209643838d588e1e3949a8a49c2dc4dfb50ee6aab985a7cf6eccba95084",
                "0xc7bd4d69c8648fe845b6e254ee355bdee759904dde840623da4d218300cb6e89",
            ],
            [
                "0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b",
                "0x50387073e2d4f7060a3c02c3c5268d8a72700a28b5cbd7e23314ae0e1ebda895",
                "0xc7bd4d69c8648fe845b6e254ee355bdee759904dde840623da4d218300cb6e89",
            ],
            [
                "0xc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b",
                "0x50387073e2d4f7060a3c02c3c5268d8a72700a28b5cbd7e23314ae0e1ebda895",
                "0xc7bd4d69c8648fe845b6e254ee355bdee759904dde840623da4d218300cb6e89",
            ],
            [
                "0xf652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f",
                "0xa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c688",
                "0x1e8cc8511a4954df48a80e5f5b8da3419a99ba3e7697574234e10893022167fc",
            ],
            [
                "0x036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0",
                "0xa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c688",
                "0x1e8cc8511a4954df48a80e5f5b8da3419a99ba3e7697574234e10893022167fc",
            ],
            [
                "0x75d78cae9ac952a6bdb1d50ff7497e0fc5986fff3e26261710f96f2e29ff6552",
                "0x1e8cc8511a4954df48a80e5f5b8da3419a99ba3e7697574234e10893022167fc",
            ],
        ],
    };

    let incomingPostRequest;

    /**
     * Construct a MerkleTree from the leaf nodes.
     */
    beforeEach(async function () {
        [owner, operator, upgrader, addr1, addr2, ismpHost, relayerAddress, ...addrs] = await ethers.getSigners();
        ZkVerifyAggregationIsmp = await ethers.getContractFactory(
            "ZkVerifyAggregationIsmp"
        );

        // Deploy mock fee token
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        mockFeeToken = await ERC20Mock.deploy("Stable Mock", "sMock");
        await mockFeeToken.waitForDeployment();

        // Deploy minimal dispatcher with mock fee token
        const DispatcherMock = await ethers.getContractFactory("DispatcherMock");
        dispatcherContract = await DispatcherMock.deploy(await mockFeeToken.getAddress());
        await dispatcherContract.waitForDeployment();

        const dispatcherAddress = await dispatcherContract.getAddress();
        await network.provider.send("hardhat_setBalance", [
            dispatcherAddress,
            "0x1000000000000000000"  // Some ETH
        ]);

        // Impersonate the dispatcher account
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [dispatcherAddress],
        });

        dispatcherSigner = await ethers.getSigner(dispatcherAddress);

        const stringToBytes = (str) => ethers.toUtf8Bytes(str);

        const encodedBody = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "bytes32"],
            [domainId, initialAggregationId, substrateTree.root]
        );

        const postRequest = {
            source: stringToBytes("SUBSTRATE-zkv_"),
            dest: stringToBytes("destination_machine_456"),
            nonce: 1234n,
            from: stringToBytes("module_from_789"),
            to: stringToBytes("module_to_101"),
            timeoutTimestamp: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
            body: encodedBody
        };

        incomingPostRequest =  {
            request: postRequest,
            relayer: relayerAddress
        };

        /*************************************************************
         *    (WIP) Match as close as possible to expected MerkleTree data:
         *    bytes32 leaf = keccak256(abi.encodePacked(inputSnark, psId));
         *************************************************************/

        //deploy verifier
        verifierInstance = await ZkVerifyAggregationIsmp.deploy();
        await verifierInstance.waitForDeployment();

        // Create initialization data
        const initData = ZkVerifyAggregationIsmp.interface.encodeFunctionData(
            "initialize",
            [await dispatcherContract.getAddress(), await upgrader.getAddress()]
        );

        // Deploy the proxy contract
        ZkVerifyAggregationIsmpProxy = await ethers.getContractFactory(
            "ZkVerifyAggregationProxy"
        );
        proxyInstance = await ZkVerifyAggregationIsmpProxy.deploy(
            await verifierInstance.getAddress(),
            initData
        );
        await proxyInstance.waitForDeployment();

        // Create a contract instance that points to the proxy but uses the ABI of the implementation
        verifierInstance = ZkVerifyAggregationIsmp.attach(
            await proxyInstance.getAddress()
        );
    });

    /********************************
     *
     *    onAccept
     *
     ********************************/
    it("ismpHost can invoke onAccept", async function () {
        await verifierInstance
            .connect(dispatcherSigner)
            .onAccept(incomingPostRequest);
        await expect(
            await verifierInstance
                .connect(operator)
                .proofsAggregations(domainId, initialAggregationId)
        ).to.equal(substrateTree.root);
    });

    it("non-ismpHost cannot invoke onAccept", async function () {
        await expect(
            verifierInstance
                .connect(owner)
                .onAccept(incomingPostRequest)
        ).to.be.revertedWithCustomError(verifierInstance, "UnauthorizedCall");
    });

    /********************************
     *
     *    verifyProofAggregation
     *
     ********************************/
    it("verifyProofAggregation returns true for each leaf in the tree", async function () {
        await verifierInstance
            .connect(dispatcherSigner)
            .onAccept(incomingPostRequest);
        await expect(
            await verifierInstance
                .connect(operator)
                .proofsAggregations(domainId, initialAggregationId)
        ).to.equal(substrateTree.root);

        for (let i = 0, j = 1; i < substrateTree.leaves.length; i++, j++) {
            let returnVal = await verifierInstance
                .connect(operator)
                .verifyProofAggregation(
                    domainId,
                    initialAggregationId,
                    substrateTree.leaves[i],
                    substrateTree.proofs[i],
                    substrateTree.leaves.length,
                    i
                );
            expect(returnVal).to.equal(true);
        }
    });

    it("verifyProofAggregation returns false if leaf is not in path", async function () {
        await verifierInstance
            .connect(dispatcherSigner)
            .onAccept(incomingPostRequest);
        await expect(
            await verifierInstance
                .connect(operator)
                .proofsAggregations(domainId, initialAggregationId)
        ).to.equal(substrateTree.root);

        let leafIndex = 6;
        let merklePath = substrateTree.proofs[6];
        let mismatchLeafIndex = 0;

        let returnVal = await verifierInstance
            .connect(operator)
            .verifyProofAggregation(
                domainId,
                initialAggregationId,
                substrateTree.leaves[mismatchLeafIndex],
                merklePath,
                substrateTree.leaves.length,
                leafIndex
            );

        expect(returnVal).to.equal(false);
    });

    it("verifyProofAggregation returns false if leafIndex is out of bounds", async function () {
        await verifierInstance
            .connect(dispatcherSigner)
            .onAccept(incomingPostRequest);
        await expect(
            await verifierInstance
                .connect(operator)
                .proofsAggregations(domainId, initialAggregationId)
        ).to.equal(substrateTree.root);

        let outOfBoundsLeafIndex = 8;
        let merklePath = substrateTree.proofs[0];
        await expect(
            verifierInstance
                .connect(operator)
                .verifyProofAggregation(
                    domainId,
                    initialAggregationId,
                    substrateTree.leaves[0],
                    merklePath,
                    substrateTree.leaves.length,
                    outOfBoundsLeafIndex
                )
        ).to.be.revertedWithCustomError(verifierInstance, "IndexOutOfBounds");
    });

    it("verifyProofAggregation returns true if only one leaf and leaf matches root", async function () {
        const _encodedBody = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "bytes32"],
            [domainId, initialAggregationId, minSubstrateTree.root]
        );

        incomingPostRequest.request.body = _encodedBody;

        await verifierInstance
            .connect(dispatcherSigner)
            .onAccept(incomingPostRequest);
        await expect(
            await verifierInstance
                .connect(operator)
                .proofsAggregations(domainId, initialAggregationId)
        ).to.equal(minSubstrateTree.root);

        let returnVal = await verifierInstance
            .connect(operator)
            .verifyProofAggregation(
                domainId,
                initialAggregationId,
                minSubstrateTree.leaves[0],
                minSubstrateTree.proofs,
                minSubstrateTree.leaves.length,
                0
            );

        expect(returnVal).to.equal(true);
    });

    /********************************
     *
     *    Upgrade Tests
     *
     ********************************/
    it("should allow upgrade by admin", async function () {
        // Deploy a new implementation
        const ZkVerifyAggregationIsmpV2 = await ethers.getContractFactory(
            "ZkVerifyAggregationIsmp"
        );
        const implementationV2 = await ZkVerifyAggregationIsmpV2.deploy();
        await implementationV2.waitForDeployment();

        // Upgrade to the new implementation
        await verifierInstance.connect(upgrader).upgradeTo(implementationV2.getAddress());

        // Verify the upgrade worked by checking the implementation address
        // This requires accessing the ERC1967 storage slot directly
        const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const currentImplementation = await ethers.provider.getStorage(
            await proxyInstance.getAddress(),
            implementationSlot
        );

        // Format the implementation address from the storage value
        const formattedImplementation = "0x" + currentImplementation.slice(26);

        expect(formattedImplementation.toLowerCase()).to.equal(
            (await implementationV2.getAddress()).toLowerCase()
        );
    });

    it("should not allow non-upgrader to upgrade", async function () {
        // Deploy a new implementation
        const ZkVerifyAggregationIsmpV2 = await ethers.getContractFactory(
            "ZkVerifyAggregationIsmp"
        );
        const implementationV2 = await ZkVerifyAggregationIsmpV2.deploy();
        await implementationV2.waitForDeployment();

        // Try to upgrade from a non-authorized account
        await expect(
            verifierInstance.connect(addr1).upgradeTo(implementationV2.getAddress())
        ).to.be.revertedWith(
            "AccessControl: account " +
            (await addr1.getAddress()).toLowerCase() +
            " is missing role " +
            upgraderRole
        );
    });
});
