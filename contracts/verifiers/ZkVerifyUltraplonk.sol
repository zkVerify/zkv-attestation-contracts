// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../interfaces/IVerifyProofAggregation.sol";

contract ZkVerifyUltraplonk {
    IVerifyProofAggregation immutable zkVerifyAggregation;

    bytes32 constant PROVING_SYSTEM_ID = keccak256(abi.encodePacked("ultraplonk"));
    bytes32 constant NO_VERSION_HASH = sha256(abi.encodePacked(""));

    /**
     * @notice Construct a ZkVerifyUltraplonk contract
     * @param _zkVerifyAggregation the address of the zkVerifyAggregation contract instance
     */
    constructor(address _zkVerifyAggregation) {
        zkVerifyAggregation = IVerifyProofAggregation(_zkVerifyAggregation);
    }

    /**
     * @notice Verify a Ultraplonk proof submitted to ZkVerify chain
     * @param _vkHash the hash of the verification key
     * @param _inputs the public inputs, as a list of field elements
     * @param _domainId the id of the domain (from zkVerify chain)
     * @param _aggregationId the id of the aggregation (from zkVerify chain)
     * @param _merklePath path from leaf to root of the merkle tree (from zkVerify chain)
     * @param _leafCount the number of leaves in the merkle tree (from zkVerify chain)
     * @param _index the index of the proof inside the merkle tree (from zkVerify chain)
     * @return bool the result of the verification
     */
    function verify(
        bytes32 _vkHash,
        uint256[] memory _inputs,
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32[] calldata _merklePath,
        uint256 _leafCount,
        uint256 _index
    ) public view returns (bool) {
        bytes32 leaf = statementHash(_vkHash, _inputs);
        return
            zkVerifyAggregation.verifyProofAggregation(_domainId, _aggregationId, leaf, _merklePath, _leafCount, _index);
    }

    /**
     * @notice Compute the statement hash associated to a Ultraplonk proof
     * @param vkHash the hash of the verification key
     * @param inputs the public inputs, as a list of field elements
     * @return bytes32 the statement hash
     */
    function statementHash(bytes32 vkHash, uint256[] memory inputs) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(PROVING_SYSTEM_ID, vkHash, NO_VERSION_HASH, keccak256(encodePublicInputs(inputs)))
        );
    }

    /**
     * @notice Encode the public inputs of a Ultraplonk proof
     * @param inputs the public inputs, as a list of field elements
     * @return bytes the encoded public inputs
     */
    function encodePublicInputs(uint256[] memory inputs) public pure returns (bytes memory) {
        return abi.encodePacked(inputs);
    }
}
