export const COST_FIELDS = Object.freeze([
  'landedCost', 'packaging', 'overhead', 'returnReserve', 'shippingSubsidy',
]);
export const PRICING_FIELDS = Object.freeze([...COST_FIELDS, 'targetMargin', 'paymentFeeRate']);
const RATE_SCALE = 1_000_000;

function scaledNumber(value, scale, name, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`${name} must be a finite non-negative number no greater than ${maximum}.`);
  }
  const scaled = Math.round(value * scale);
  if (Math.abs(value * scale - scaled) > 0.000001) {
    throw new RangeError(`${name} has too many decimal places.`);
  }
  return scaled;
}

/**
 * Forecast net contribution using explicitly allocated costs, not market data.
 * Integer arithmetic rounds UP to a multiple of BDT 10 without float drift.
 * Costs accept two decimal places; fee and margin rates accept six.
 */
export function calculatePricing(input) {
  const costCents = COST_FIELDS.map((field) => scaledNumber(input[field], 100, field, 1_000_000));
  const marginUnits = scaledNumber(input.targetMargin, RATE_SCALE, 'targetMargin', 0.7);
  const feeUnits = scaledNumber(input.paymentFeeRate, RATE_SCALE, 'paymentFeeRate', 1);
  if (input.targetMargin >= 0.7) throw new RangeError('targetMargin must be less than 0.7.');
  const denominatorUnits = RATE_SCALE - marginUnits - feeUnits;
  if (denominatorUnits <= 0) throw new RangeError('1 - targetMargin - paymentFeeRate must be positive.');
  const totalCents = costCents.reduce((sum, value) => sum + value, 0);
  if (totalCents <= 0) throw new RangeError('Combined allocated costs must be greater than zero.');
  const numerator = BigInt(totalCents) * BigInt(RATE_SCALE);
  const divisor = BigInt(denominatorUnits) * 1_000n;
  const price = Number((numerator + divisor - 1n) / divisor) * 10;
  if (!Number.isSafeInteger(price) || price > 100_000_000) {
    throw new RangeError('Calculated price exceeds the supported BDT 100,000,000 limit.');
  }
  const costTotal = totalCents / 100;
  const paymentFee = price * input.paymentFeeRate;
  const netProfit = price - costTotal - paymentFee;
  return {
    price,
    rawPrice: costTotal / (denominatorUnits / RATE_SCALE),
    costTotal,
    paymentFee,
    netProfit,
    netMargin: netProfit / price,
    targetMargin: input.targetMargin,
    paymentFeeRate: input.paymentFeeRate,
  };
}
