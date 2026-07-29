import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'create-order' && req.method === 'POST') {
      return await handleCreateOrder(req, supabase, user.id, corsHeaders);
    }
    if (action === 'verify-payment' && req.method === 'POST') {
      return await handleVerifyPayment(req, supabase, user.id, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCreateOrder(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const body = await req.json();
  const amount = body.amount || 4900;

  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!keyId || !keySecret) {
    return new Response(JSON.stringify({ error: 'Razorpay keys not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(keyId + ':' + keySecret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: `valuable_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: userId },
    }),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    return new Response(JSON.stringify({ error: 'Razorpay order failed', detail: errText }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const order = await orderRes.json();

  const { error: payErr } = await supabase.from('payments').insert({
    user_id: userId,
    amount,
    status: 'created',
    razorpay_order_id: order.id,
  });
  if (payErr) {
    return new Response(JSON.stringify({ error: 'Failed to record payment' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    order_id: order.id,
    amount,
    currency: 'INR',
    key_id: keyId,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleVerifyPayment(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return new Response(JSON.stringify({ error: 'Missing payment details' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keySecret) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const paymentData = new TextEncoder().encode(`${razorpay_order_id}|${razorpay_payment_id}`);
  const keyData = new TextEncoder().encode(keySecret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, paymentData);
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig !== razorpay_signature) {
    await supabase.from('payments')
      .update({ status: 'failed', razorpay_payment_id })
      .eq('razorpay_order_id', razorpay_order_id);
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await supabase.from('payments')
    .update({ status: 'paid', razorpay_payment_id })
    .eq('razorpay_order_id', razorpay_order_id);

  const { error } = await supabase.from('profiles')
    .update({
      is_premium: true,
      premium_expires_at: expiresAt.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    premium_expires_at: expiresAt.toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
