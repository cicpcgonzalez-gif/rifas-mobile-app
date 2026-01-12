import AsyncStorage from '@react-native-async-storage/async-storage';

const ARCHIVE_KEY = 'ticket_archive_v1';
const MAX_ITEMS = 200;

const safeParseJsonArray = (raw) => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
};

const stableArchiveIdForTicket = (ticket) => {
  const id = ticket?.id != null ? String(ticket.id) : '';
  if (id) return id;

  const serial = ticket?.serialNumber != null ? String(ticket.serialNumber) : '';
  if (serial) return `serial:${serial}`;

  const raffleId = ticket?.raffleId != null ? String(ticket.raffleId) : (ticket?.raffle?.id != null ? String(ticket.raffle.id) : '');
  const createdAt = ticket?.createdAt != null ? String(ticket.createdAt) : '';
  const numbers = Array.isArray(ticket?.numbers) ? ticket.numbers.join(',') : '';
  return `fallback:${raffleId}:${createdAt}:${numbers}`;
};

const normalizeArchivedTicket = (ticket) => {
  const raffle = ticket?.raffle || {};
  const payment = ticket?.payment || {};

  const raffleStatus = String(raffle?.status || ticket?.status || '').toLowerCase();

  return {
    archiveId: stableArchiveIdForTicket(ticket),
    raffleId: raffle?.id != null ? String(raffle.id) : (ticket?.raffleId != null ? String(ticket.raffleId) : ''),
    raffleTitle: raffle?.title || ticket?.raffleTitle || 'Rifa',
    digits: raffle?.digits ?? ticket?.digits ?? null,
    numbers: Array.isArray(ticket?.numbers) ? ticket.numbers.filter((n) => n !== null && n !== undefined) : [],
    createdAt: ticket?.createdAt || payment?.purchasedAt || null,
    purchasedAt: payment?.purchasedAt || ticket?.createdAt || null,
    totalSpent: payment?.totalSpent ?? null,
    unitPrice: payment?.unitPrice ?? ticket?.unitPrice ?? ticket?.price ?? raffle?.ticketPrice ?? raffle?.price ?? null,
    paymentMethod: payment?.method || null,
    sellerName: raffle?.user?.name || null,
    sellerSecurityId: raffle?.user?.securityId || null,
    serialNumber: ticket?.serialNumber || null,
    isWinner: !!ticket?.isWinner,
    resultsPublished: !!ticket?.resultsPublished,
    raffleStatus: raffleStatus || null,
    savedAt: new Date().toISOString()
  };
};

export const getArchivedTickets = async () => {
  const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
  return safeParseJsonArray(raw);
};

export const upsertArchivedTickets = async (tickets) => {
  const incoming = Array.isArray(tickets) ? tickets.filter(Boolean) : [];
  if (incoming.length === 0) return;

  const current = await getArchivedTickets();
  const byId = new Map();

  for (const t of current) {
    const key = t?.archiveId != null ? String(t.archiveId) : '';
    if (key) byId.set(key, t);
  }

  for (const t of incoming) {
    const normalized = normalizeArchivedTicket(t);
    if (!normalized.archiveId) continue;
    const prev = byId.get(normalized.archiveId);
    byId.set(normalized.archiveId, { ...prev, ...normalized, savedAt: prev?.savedAt || normalized.savedAt });
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => {
      const ta = new Date(a?.purchasedAt || a?.createdAt || 0).getTime();
      const tb = new Date(b?.purchasedAt || b?.createdAt || 0).getTime();
      return tb - ta;
    })
    .slice(0, MAX_ITEMS);

  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(merged));
};

export const deleteArchivedTicket = async (archiveId) => {
  const id = String(archiveId || '').trim();
  if (!id) return;
  const current = await getArchivedTickets();
  const next = current.filter((t) => String(t?.archiveId || '') !== id);
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
};

export const clearClosedArchivedTickets = async () => {
  const current = await getArchivedTickets();
  const next = current.filter((t) => String(t?.raffleStatus || '').toLowerCase() !== 'closed');
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
};

export const clearArchivedTickets = async () => {
  await AsyncStorage.removeItem(ARCHIVE_KEY);
};
