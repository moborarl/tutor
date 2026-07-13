import type { CustomAiFormat } from '@shared/types';

export interface CustomAiConfig {
  baseUrl: string;
  apiFormat: CustomAiFormat;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

export function normalizeCustomAiConfig(baseUrl: string, apiFormat: string | undefined): CustomAiConfig {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error('custom_base_url_required');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('custom_base_url_invalid');
  }

  if (url.protocol !== 'https:') throw new Error('custom_base_url_https_only');
  if (url.username || url.password) throw new Error('custom_base_url_no_basic_auth');
  if (url.search || url.hash) throw new Error('custom_base_url_no_query');

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost'
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === '0.0.0.0'
    || isPrivateIpv4(hostname)
    || isPrivateIpv6(hostname)
  ) {
    throw new Error('custom_base_url_not_public');
  }

  const normalizedBaseUrl = url.toString().replace(/\/+$/, '');
  const normalizedFormat = apiFormat === 'chat_completions' ? 'chat_completions' : 'responses';
  return { baseUrl: normalizedBaseUrl, apiFormat: normalizedFormat };
}
