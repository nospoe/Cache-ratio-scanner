import ipaddr from "ipaddr.js";
import { URL } from "url";
import dns from "dns/promises";

const BLOCKED_RANGES = [
  // Loopback
  "127.0.0.0/8",
  "::1/128",
  // Private
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "fc00::/7",
  // Link-local
  "169.254.0.0/16",
  "fe80::/10",
  // Multicast
  "224.0.0.0/4",
  "ff00::/8",
];

function isPrivateIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    for (const range of BLOCKED_RANGES) {
      const [rangeAddr, prefixLen] = range.split("/");
      try {
        const rangeIp = ipaddr.parse(rangeAddr);
        if (
          parsed.kind() === rangeIp.kind() &&
          parsed.match(rangeIp, parseInt(prefixLen))
        ) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function validateUrl(
  urlStr: string,
  enabled = true
): Promise<{ valid: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "Only http and https protocols are allowed" };
  }

  if (!enabled) return { valid: true };

  const host = parsed.hostname;

  // Direct IP check
  if (ipaddr.isValid(host)) {
    if (isPrivateIp(host)) {
      return { valid: false, reason: "Private/reserved IP addresses are not allowed" };
    }
    return { valid: true };
  }

  // DNS resolution check
  try {
    const addresses = await dns.lookup(host, { all: true });
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return {
          valid: false,
          reason: `Hostname resolves to a private/reserved IP address (${address})`,
        };
      }
    }
  } catch {
    return { valid: false, reason: "Could not resolve hostname" };
  }

  return { valid: true };
}

export function validateUrlSync(urlStr: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "Only http and https protocols are allowed" };
  }

  const host = parsed.hostname;
  if (ipaddr.isValid(host) && isPrivateIp(host)) {
    return { valid: false, reason: "Private/reserved IP addresses are not allowed" };
  }

  return { valid: true };
}
