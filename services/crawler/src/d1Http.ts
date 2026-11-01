/** Runs statements on a remote D1 database through Cloudflare's REST API. */
export class D1Http {
  private url: string;
  private token: string;

  constructor(accountId: string, databaseId: string, token: string) {
    this.url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    this.token = token;
  }

  async query(sql: string, params: unknown[]): Promise<void> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; errors?: { message: string }[] } | null;
    if (!response.ok || !body?.success) {
      const reason = body?.errors?.map((e) => e.message).join("; ") || response.statusText;
      throw new Error(`D1 query failed (${response.status}): ${reason}`);
    }
  }
}
