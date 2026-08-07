import PushNotifications from "@pusher/push-notifications-server";

// Beams is only active once BEAMS_INSTANCE_ID / BEAMS_SECRET_KEY are set in .env.
// Everything below no-ops (and logs once) if it isn't configured, so the rest of
// the app works fine without push notifications set up.
let beamsClient = null;
if (process.env.BEAMS_INSTANCE_ID && process.env.BEAMS_SECRET_KEY) {
  beamsClient = new PushNotifications({
    instanceId: process.env.BEAMS_INSTANCE_ID,
    secretKey: process.env.BEAMS_SECRET_KEY,
  });
  
} else {
  console.warn(
    "Pusher Beams: BEAMS_INSTANCE_ID / BEAMS_SECRET_KEY not set — push notifications disabled"
  );
}

export function beamsEnabled() {
  return !!beamsClient;
}

// Issues a Beams auth token so the client SDK can call setUserId(userId, ...) —
// required before publishToUsers([userId]) will reach that user's devices.
// Throws if Beams isn't configured; callers should only call this behind requireAuth.
export function generateBeamsToken(userId) {
  if (!beamsClient) throw new Error("Push notifications are not configured on this server");
  return beamsClient.generateToken(String(userId));
}

// Sends a real push notification to every device currently subscribed as this user
// (i.e. every device that has called setUserId for them). Safe to call even if Beams
// isn't configured, or if the user has no push-subscribed devices — never throws.
export async function pushToUser(userId, { title, body, deepLink, icon }) {
  if (!beamsClient) return;
  try {
    // Beams requires an absolute URI for `icon` — a relative path like "/logo.png"
    // fails validation with a 422 and silently drops the whole notification.
    const baseUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    const resolvedIcon = icon || (baseUrl ? `${baseUrl}/logo.png` : undefined);

    await beamsClient.publishToUsers([String(userId)], {
      web: {
        notification: {
          title: title?.slice(0, 100) || "New message",
          body: body?.slice(0, 200) || "",
          ...(resolvedIcon ? { icon: resolvedIcon } : {}),
          deep_link: deepLink,
        },
      },
    });
  } catch (err) {
    // A publish failure (e.g. the user has never granted permission on any device)
    // should never break message sending — just log it.
    console.error("Beams push failed:", err.message);
  }
}