export const formatTicketNumber = (value, digits = 4) => String(value ?? '').padStart(digits, '0');
