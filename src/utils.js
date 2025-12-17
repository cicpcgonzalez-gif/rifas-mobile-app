export const formatTicketNumber = (value, digits = 4) => String(value ?? '').padStart(digits, '0');

export const formatMoneyVES = (value, { withSymbol = true, decimals = 2 } = {}) => {
	const n = Number(value);
	const safe = Number.isFinite(n) ? n : 0;
	const d = Number.isFinite(Number(decimals)) ? Math.max(0, Math.min(4, Number(decimals))) : 2;
	const num = safe.toFixed(d);
	return withSymbol ? `Bs. ${num}` : num;
};
