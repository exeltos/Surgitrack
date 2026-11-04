/** A single address is kept as «address/32» (IPv4) or «address/128» (IPv6); it is shown as the address alone. */
export const plainAddress = (ip: string) => (ip.includes(':') ? ip.replace(/\/128$/, '') : ip.replace(/\/32$/, ''));
