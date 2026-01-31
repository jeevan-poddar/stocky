import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility for URL-safe Base64 encoding
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

    // Clean the Private Key strictly
    const rawKey = serviceAccount.private_key
        .replace(/\\n/g, "\n")
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s+/g, "");

    const binaryKey = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(message)
    );

    const assertion = `${message}.${base64url(new Uint8Array(signature))}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion
        })
    });

    const data = await res.json();
    if (data.error) throw new Error(`Google Auth: ${data.error_description || data.error}`);
    return data.access_token;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Fetch Medicines (Proven logic)
        const { data: items } = await supabase.from('medicines').select('*');
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);

        const expiring = (items || []).filter(i => {
            const d = i?.expiry_date || i?.Expiry_Date || i?.expiryDate;
            const u = i?.user_id || i?.User_Id;
            return d && u && new Date(d) <= thirtyDays;
        });

        if (!expiring.length) return new Response(JSON.stringify({ success: true, count: 0 }));

        // 2. Get User Tokens
        const uids = [...new Set(expiring.map(m => m?.user_id || m?.User_Id))];
        const { data: tokenRows } = await supabase.from('fcm_tokens').select('token').in('user_id', uids);

        // 3. Authenticate and Send
        const secret = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY')!);
        const token = await getAccessToken(secret);

        if (tokenRows && tokenRows.length > 0) {
            for (const t of tokenRows) {
                if (!t?.token) continue;
                await fetch(`https://fcm.googleapis.com/v1/projects/${secret.project_id}/messages:send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        message: {
                            token: t.token,
                            notification: {
                                title: "Stocky: Expiry Alert",
                                body: `You have ${expiring.length} medicines expiring soon.`
                            },
                            data: { url: "/returns" }
                        }
                    })
                });
            }
        }

        return new Response(JSON.stringify({ success: true, notified: expiring.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});