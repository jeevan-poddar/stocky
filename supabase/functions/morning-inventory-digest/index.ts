import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64url(source: Uint8Array | string): string {
    let encoded = typeof source === "string" ? btoa(source) : btoa(String.fromCharCode(...source));
    return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(serviceAccount: any) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/firebase.messaging"
    }));
    const message = `${header}.${payload}`;
    const rawKey = serviceAccount.private_key.replace(/\\n/g, "\n").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
    const binaryKey = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(message));
    return `${message}.${base64url(new Uint8Array(signature))}`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { data: medicines } = await supabase.from('medicines').select('*');
        const { data: profiles } = await supabase.from('profiles').select('id, expiry_threshold_days');

        if (!medicines || medicines.length === 0) return new Response(JSON.stringify({ success: true, message: "No medicines" }));

        const now = new Date();
        const expiringByOwner: Record<string, { expired: any[], soon: any[] }> = {};

        medicines.forEach(med => {
            const userId = med.user_id || med.User_Id || med.userId;
            const profile = profiles?.find(p => p.id === userId);
            const threshold = profile?.expiry_threshold_days || 30;

            let rawDate = med.expiry_date || med.Expiry_Date || med.expiryDate;
            let expiryDate: Date;

            if (typeof rawDate === 'string' && rawDate.includes('/')) {
                const parts = rawDate.split('/');
                expiryDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                expiryDate = new Date(rawDate);
            }

            // CORRECTED COLUMN NAMES HERE
            const packs = Number(med.stock_packets || med.Stock_Packets || 0);
            const loose = Number(med.stock_loose || med.Stock_Loose || 0);
            const hasStock = packs > 0 || loose > 0;

            const limitDate = new Date();
            limitDate.setDate(now.getDate() + threshold);

            console.log(`Checking: ${med.name} | Stock: ${packs}p, ${loose}l | Exp: ${expiryDate.toDateString()} | Threshold: ${threshold}`);

            if (hasStock) {
                if (!expiringByOwner[userId]) expiringByOwner[userId] = { expired: [], soon: [] };

                if (expiryDate < now) {
                    expiringByOwner[userId].expired.push(med);
                } else if (expiryDate <= limitDate) {
                    expiringByOwner[userId].soon.push(med);
                }
            }
        });

        if (Object.keys(expiringByOwner).length === 0) return new Response(JSON.stringify({ success: true, message: "No stock matching criteria" }));

        const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY')!);
        const jwt = await getAccessToken(serviceAccount);
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt })
        });
        const { access_token } = await tokenRes.json();

        for (const [userId, cat] of Object.entries(expiringByOwner)) {
            const { data: tokens } = await supabase.from('fcm_tokens').select('token').eq('user_id', userId);
            if (tokens && tokens.length > 0) {
                let body = "";
                if (cat.expired.length > 0) body += `${cat.expired.length} expired. `;
                if (cat.soon.length > 0) body += `${cat.soon.length} expiring soon.`;

                for (const t of tokens) {
                    await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
                        body: JSON.stringify({
                            message: { token: t.token, notification: { title: "Stocky: Alert", body: body.trim() } }
                        })
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }));
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});