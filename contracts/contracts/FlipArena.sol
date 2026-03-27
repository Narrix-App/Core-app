// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title FlipArena — Narrix 30-Second Pulse Flip
 * @notice Users bet UP or DOWN on a score oracle. Every 30 seconds the round
 *         settles and the winning pool splits the entire pot proportionally.
 *         The relayer (backend) is the only caller – users never sign per-bet.
 *         Tokens are pulled via HIP-336 allowances (ERC-20 transferFrom).
 */
contract FlipArena {
    address public immutable nrxToken;
    address public relayer;

    uint256 public poolUp;
    uint256 public poolDown;

    struct Bet {
        address user;
        uint256 amount;
    }

    Bet[] private upBets;
    Bet[] private downBets;
    uint256 public roundNumber;

    event Deposited(address indexed user, uint8 direction, uint256 amount, uint256 round);
    event RoundSettled(uint256 round, uint8 winner, uint256 totalPool);
    event PayoutSent(address indexed user, uint256 amount, uint256 round);

    constructor(address _nrxToken) {
        nrxToken = _nrxToken;
        relayer = msg.sender;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    // -- Relayer calls this on every user bet --
    function deposit(address user, uint8 direction, uint256 amount) external onlyRelayer {
        require(direction <= 1, "Bad dir"); // 0 = UP, 1 = DOWN
        require(amount > 0, "Zero");

        // Pull NRX from user → contract (requires user's HIP-336 allowance)
        bool ok = IERC20(nrxToken).transferFrom(user, address(this), amount);
        require(ok, "Transfer failed");

        if (direction == 0) {
            upBets.push(Bet(user, amount));
            poolUp += amount;
        } else {
            downBets.push(Bet(user, amount));
            poolDown += amount;
        }

        emit Deposited(user, direction, amount, roundNumber);
    }

    // -- Relayer calls this every 30 seconds --
    function settleRound(uint8 winningDirection) external onlyRelayer {
        require(winningDirection <= 1, "Bad dir");

        uint256 totalPool = poolUp + poolDown;

        if (totalPool > 0) {
            Bet[] storage winners = winningDirection == 0 ? upBets : downBets;
            uint256 winningPool = winningDirection == 0 ? poolUp : poolDown;

            if (winningPool > 0) {
                // Proportional split: each winner gets (theirBet / winningPool) * totalPool
                for (uint256 i = 0; i < winners.length; i++) {
                    uint256 payout = (winners[i].amount * totalPool) / winningPool;
                    IERC20(nrxToken).transfer(winners[i].user, payout);
                    emit PayoutSent(winners[i].user, payout, roundNumber);
                }
            }
            // If no one bet on the winning side, funds stay in contract (house edge)
        }

        emit RoundSettled(roundNumber, winningDirection, totalPool);

        delete upBets;
        delete downBets;
        poolUp = 0;
        poolDown = 0;
        roundNumber++;
    }

    function getRoundInfo()
        external
        view
        returns (uint256 round, uint256 up, uint256 down, uint256 upCount, uint256 downCount)
    {
        return (roundNumber, poolUp, poolDown, upBets.length, downBets.length);
    }
}
