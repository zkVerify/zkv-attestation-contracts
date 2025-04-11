const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Verifier-specific contracts", function () {
    let verifyProofAggregationMock;
    const zkVerifyContracts = {};

    beforeEach(async function () {
        VerifyProofAggregationMock = await ethers.getContractFactory("VerifyProofAggregationMock");
        verifyProofAggregationMock = await VerifyProofAggregationMock.deploy();
        await verifyProofAggregationMock.waitForDeployment();

        const verifiersNames = ["ZkVerifyGroth16", "ZkVerifyUltraplonk", "ZkVerifyRisc0"];

        for (const name of verifiersNames) {
            const factory = await ethers.getContractFactory(name);
            const contract = await factory.deploy(verifyProofAggregationMock.getAddress());
            await contract.waitForDeployment();
            zkVerifyContracts[name] = contract;
        }
    });

    describe("encodePublicInput", function () {
        const cases = [
            {
                verifier: "ZkVerifyGroth16",
                label: "empty input",
                inputs: [],
                output: "0x"
            },
            {
                verifier: "ZkVerifyGroth16",
                label: "non-trivial input",
                inputs: [
                    "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
                    "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
                ],
                output: "0x1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100"
            },
            {
                verifier: "ZkVerifyUltraplonk",
                label: "empty input",
                inputs: [],
                output: "0x"
            },
            {
                verifier: "ZkVerifyUltraplonk",
                label: "non-trivial input",
                inputs: [
                    "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
                    "0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
                ],
                output: "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
            },
        ];
        for (const { verifier, label, inputs, output } of cases) {
            it("Method encodePublicInputs of " + verifier + " should work in case of " + label, async function () {
                const contract = zkVerifyContracts[verifier];
                await expect(
                    await contract.encodePublicInputs(inputs)
                ).to.be.equal(output);
            });
        };
    });

    describe("statementHash", function () {
        const cases = [
            {
                verifier: "ZkVerifyGroth16",
                vkHash: "0x03cd0bc2734df75ba69a2328fa4bac1bc4981c6942a421826d36e6cb00318df7",
                input: ["42", "24"],
                leaf: "0x241367b89d78d1f33d40b4704a186826fe863ad6abaa7a4596ba964c442487c4"
            },
            {
                verifier: "ZkVerifyUltraplonk",
                vkHash: "0x1b8d5bf3f17971c1ba4271feef9607d829dc85186873b0f7d5c116cc63947ed0",
                input: ["1", "2"],
                leaf: "0xcdb0575be792ede9060ff611cea6318e53c7894a4856c13f4d42a592e7174665"
            },
            {
                verifier: "ZkVerifyRisc0",
                version: "risc0:v1.0",
                vkHash: "0x32e1a33f3988c3cdf127e709cc0323a258b28df750b7a2d5ddc4c5e37f007d99",
                input: "0x01000078",
                leaf: "0x76082d85afb6dd62d982e672365143d9eee6e2640e60ef75e5cd1911748b4c1c"
            },
            {
                verifier: "ZkVerifyRisc0",
                version: "risc0:v1.1",
                vkHash: "0x2addbbeb4ddb2f2ec2b4a0a8a21c03f7d3bf42cfd2ee9f4a69d2ebd9974218b6",
                input: "0x8105000000000000",
                leaf: "0x1478ead484979edb8644274b3a0435b10bed35e0e5e0d1efa2732af3ac6e666c"
            },
        ];
        for (const { verifier, version, vkHash, input, leaf } of cases) {
            it("Method statementHash of " + verifier + (version ? (" version " + version) : "") + " should compute correct value", async function () {
                const contract = zkVerifyContracts[verifier];
                if (version) {
                    await expect(
                        await contract.statementHash(vkHash, version, input)
                    ).to.be.equal(leaf);
                } else {
                    await expect(
                        await contract.statementHash(vkHash, input)
                    ).to.be.equal(leaf);
                }
            });
        };
    });

    describe("verify", function () {
        const cases = [
            {
                verifier: "ZkVerifyGroth16",
                input: ["42"],
            },
            {
                verifier: "ZkVerifyUltraplonk",
                input: ["42"],
            },
            {
                verifier: "ZkVerifyRisc0",
                version: "risc0:v1.0",
                input: "0x01",
            },
        ];
        for (const { verifier, version, input } of cases) {
            it("Method verify of " + verifier + " should call the VerifyProofAggregation contract correctly", async function () {
                const contract = zkVerifyContracts[verifier];

                const domainId = 1;
                const aggregationId = 2;
                const vkHash = "0x0000000000000000000000000000000000000000000000000000000000000003"
                let leaf;
                if (version) {
                    leaf = await contract.statementHash(vkHash, version, input);
                } else {
                    leaf = await contract.statementHash(vkHash, input);
                }
                const merklePath = [
                    "0x0000000000000000000000000000000000000000000000000000000000000004",
                    "0x0000000000000000000000000000000000000000000000000000000000000005"];
                const leafCount = 6;
                const index = 7;

                const expectedArgs = {
                    domainId: domainId,
                    aggregationId: aggregationId,
                    leaf: leaf,
                    merklePath: merklePath,
                    leafCount: leafCount,
                    index: index,
                };

                await verifyProofAggregationMock.setExpectedArgs(expectedArgs);

                if (version) {
                    await expect(
                        await contract.verify(
                            vkHash,
                            version,
                            input,
                            domainId,
                            aggregationId,
                            merklePath,
                            leafCount,
                            index
                        )
                    ).to.be.equal(true);
                } else {
                    await expect(
                        await contract.verify(
                            vkHash,
                            input,
                            domainId,
                            aggregationId,
                            merklePath,
                            leafCount,
                            index
                        )
                    ).to.be.equal(true);
                }
            });
        }
    });
});
