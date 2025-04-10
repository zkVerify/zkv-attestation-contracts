// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ZkVerifyAggregationIsmp.sol";
import "./ZkVerifyAggregation.sol";

/**
 * @title ZkVerifyAggregationGlobal Contract
 * @notice It allows submitting and verifying aggregation proofs coming from zkVerify chain for both versions Ismp and Non Ismp one.
 */
contract ZkVerifyAggregationGlobal is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IsmpGuest, BaseIsmpModule, ZkVerifyAggregationBase {

    /// @dev Role required for operator to submit/verify proofs.
    bytes32 public constant OPERATOR = keccak256("OPERATOR");

    /// @dev Role that allows upgrading the implementation
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice State machine for source request
    bytes public constant STATE_MACHINE = bytes("SUBSTRATE-zkv_");

    /// @notice Batch submissions must have an equal number of ids to proof aggregations.
    error InvalidBatchCounts();

    // @notice Action is unauthorized
    error UnauthorizedAction();

    using Bytes for bytes;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor)
     * @param _operator Operator for the contract
     * @param _ismpHost Ismp host contract address
     */
    function initialize(address _operator, address _ismpHost, address _upgrader) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __IsmpGuest_init(_ismpHost);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR, _operator);
        _grantRole(UPGRADER_ROLE, _upgrader);
    }


    function host() public view override returns (address) {
        return getHost();
    }

    /**
     * @notice Submit Aggregation
     * @param _domainId the id of the domain
     * @param _aggregationId the id of the aggregation from the NewHorizen Relayer
     * @param _proofsAggregation aggregation of a set of proofs
     * @dev caller must have the OPERATOR role, admin can add caller via AccessControl.grantRole()
     */
    function submitAggregation(
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32 _proofsAggregation
    ) external onlyRole(OPERATOR) {
        _registerAggregation(_domainId, _aggregationId, _proofsAggregation);
    }

    /**
     * @notice Submit a Batch of aggregations, for a given domain Id, useful if a relayer needs to catch up.
     * @param _domainId id of domain
     * @param _aggregationIds ids of aggregations from the NewHorizen Relayer
     * @param _proofsAggregations a set of proofs
     * @dev caller must have the OPERATOR role, admin can add caller via AccessControl.grantRole()
     */
    function submitAggregationBatchByDomainId(
        uint256 _domainId,
        uint256[] calldata _aggregationIds,
        bytes32[] calldata _proofsAggregations
    ) external onlyRole(OPERATOR) {

        if(_aggregationIds.length != _proofsAggregations.length) {
            revert InvalidBatchCounts();
        }

        for (uint256 i; i < _aggregationIds.length;) {
            _registerAggregation(_domainId, _aggregationIds[i], _proofsAggregations[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Receive hyperbridge message containing an aggregation
     * @param incoming request from hyperbridge
     * @dev caller must be host address or risk critical vulnerabilities from unauthorized calls to this method by malicious actors.
     */
    function onAccept(IncomingPostRequest memory incoming) external override onlyHost {

        PostRequest memory request = incoming.request;
        if (!request.source.equals(STATE_MACHINE)) revert UnauthorizedAction();

        (uint256 _domainId, uint256 _aggregationId, bytes32 _proofsAggregation) = abi.decode(request.body, (uint256, uint256, bytes32));

        _registerAggregation(_domainId, _aggregationId, _proofsAggregation);
    }

    /**
     * @notice Function that allows the contract to be upgraded
     * @dev Only accounts with the UPGRADER_ROLE can call this function
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}