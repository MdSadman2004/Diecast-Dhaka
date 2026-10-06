// Illustrative allocations and demonstration stock, NOT Bangladesh market facts.
const shared = {
  series: 'Mainline', scale: '1:64', demo: true,
  packaging: 20, overhead: 25, returnReserve: 10, shippingSubsidy: 0,
  targetMargin: 0.30, paymentFeeRate: 0.015,
};

export const DEMO_PRODUCTS = Object.freeze([
  { id: 'skyline', name: 'Nissan Skyline GT-R (R34)', category: 'JDM', model: 'coupe', color: '#779eab', landedCost: 190, stock: 12 },
  { id: 'porsche', name: 'Porsche 911 GT3', category: 'European', model: 'sport', color: '#e86527', landedCost: 225, stock: 8 },
  { id: 'supra', name: 'Toyota Supra', category: 'JDM', model: 'coupe', color: '#b62f32', landedCost: 205, stock: 10 },
  { id: 'mustang', name: "'67 Ford Mustang", category: 'Muscle', model: 'muscle', color: '#445e36', landedCost: 180, stock: 9 },
  { id: 'civic', name: 'Honda Civic Custom', category: 'JDM', model: 'hatch', color: '#d6b44e', landedCost: 195, stock: 11 },
  { id: 'defender', name: 'Land Rover Defender 90', category: 'Adventure', model: 'suv', color: '#b7b3a4', landedCost: 215, stock: 7 },
].map((product) => Object.freeze({ ...shared, ...product })));

export const DELIVERY = Object.freeze({ dhaka: 80, outside: 150 });
export const PRICING_NOTE = 'Demo prices use illustrative cost allocations, not current market quotations. Price = (landed cost + packaging + overhead + return reserve + shipping subsidy) / (1 - target margin - payment fee rate), rounded UP to BDT 10. The default target is 30% forecast net contribution, not a guarantee of realized business profit. Delivery is charged separately as a pass-through; all inventory and orders are demonstrations. Castings and procedural 3D assets are not authenticated product assets.';
