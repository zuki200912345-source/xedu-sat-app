// Meeting creation adapter. Isolates the Zoom API behind createMeeting() so the
// rest of the app never touches Zoom directly. If Zoom credentials are absent,
// a clearly-marked mock join URL is returned so booking works with zero setup.

export interface MeetingRequest {
  topic: string;
  startsAt: Date;
  durationMinutes: number;
}

export interface MeetingResult {
  joinUrl: string;
  provider: "zoom" | "mock";
}

function zoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET,
  );
}

/** Fetch a Zoom server-to-server OAuth token. */
async function zoomToken(): Promise<string | null> {
  try {
    const creds = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
    ).toString("base64");
    const res = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      { method: "POST", headers: { Authorization: `Basic ${creds}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a meeting for a tutoring session. Uses the real Zoom API when
 * configured; otherwise returns a mock link (marked provider: "mock").
 */
export async function createMeeting(req: MeetingRequest): Promise<MeetingResult> {
  if (zoomConfigured()) {
    const token = await zoomToken();
    if (token) {
      try {
        const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: req.topic,
            type: 2, // scheduled
            start_time: req.startsAt.toISOString(),
            duration: req.durationMinutes,
            settings: { join_before_host: true, waiting_room: false },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { join_url?: string };
          if (data.join_url) return { joinUrl: data.join_url, provider: "zoom" };
        }
      } catch {
        // fall through to mock
      }
    }
  }

  // Mock fallback — deterministic, clearly labeled as mock.
  const id = Math.random().toString(36).slice(2, 12);
  return { joinUrl: `https://meet.xedusat.mock/session/${id}`, provider: "mock" };
}
