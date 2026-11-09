export function planRefundSplit(
  amountEgp: number,
  walletCapturedEgp: number,
  walletAlreadyRefundedEgp: number,
) {
  const walletRemainingEgp = Math.max(
    0,
    walletCapturedEgp - walletAlreadyRefundedEgp,
  );
  const walletRefundEgp = Math.min(amountEgp, walletRemainingEgp);
  return {
    walletRefundEgp,
    gatewayRefundEgp: amountEgp - walletRefundEgp,
  };
}
