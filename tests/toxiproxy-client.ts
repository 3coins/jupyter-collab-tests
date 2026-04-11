const TOXIPROXY_URL = process.env.TOXIPROXY_URL ?? 'http://localhost:8474';

export type ToxicType =
  | 'latency'
  | 'bandwidth'
  | 'timeout'
  | 'reset_peer'
  | 'slow_close'
  | 'slicer'
  | 'limit_data';

export type ToxicStream = 'downstream' | 'upstream';

export interface ToxicAttributes {
  // latency
  latency?: number;
  jitter?: number;
  // bandwidth
  rate?: number;
  // timeout
  timeout?: number;
  // slow_close
  delay?: number;
  // slicer
  average_size?: number;
  size_variation?: number;
  // limit_data
  bytes?: number;
}

export class ToxiproxyClient {
  constructor(private baseUrl = TOXIPROXY_URL) {}

  async createProxy(name: string, listen: string, upstream: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/proxies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, listen, upstream, enabled: true }),
    });
    // 409 means proxy already exists — that's fine
    if (!res.ok && res.status !== 409) {
      throw new Error(`createProxy failed (${res.status}): ${await res.text()}`);
    }
  }

  async deleteProxy(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/proxies/${name}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`deleteProxy failed (${res.status}): ${await res.text()}`);
    }
  }

  async addToxic(
    proxyName: string,
    toxicName: string,
    type: ToxicType,
    stream: ToxicStream,
    toxicity: number,
    attributes: ToxicAttributes
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: toxicName, type, stream, toxicity, attributes }),
    });
    if (!res.ok) {
      throw new Error(`addToxic failed (${res.status}): ${await res.text()}`);
    }
  }

  async removeToxic(proxyName: string, toxicName: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/proxies/${proxyName}/toxics/${toxicName}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`removeToxic failed (${res.status}): ${await res.text()}`);
    }
  }

  async setProxyEnabled(proxyName: string, enabled: boolean): Promise<void> {
    const res = await fetch(`${this.baseUrl}/proxies/${proxyName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      throw new Error(`setProxyEnabled failed (${res.status}): ${await res.text()}`);
    }
  }

  async resetAll(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`resetAll failed (${res.status}): ${await res.text()}`);
    }
  }
}
