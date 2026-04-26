// Edge Function: invite-agent
//
// Sends a team-invitation email via Supabase Auth (`inviteUserByEmail`).
// Called by web/mobile admin UI when an admin types a new agent's email.
//
// Request:  POST /functions/v1/invite-agent
//           Authorization: Bearer <admin's JWT>
//           Body: { "email": "agent@example.com" }
//
// Response: 200 { success: true, invite_token, company_name, email }
//           400 { error, code? }   — bad input / company not activated
//           401 { error }           — missing or invalid JWT
//           403 { error, code }     — caller is not a company admin
//           409 { error, code }     — email occupied / orphan
//           429 { error, code }     — rate limit (>10 invitations/min)
//           500 { error, details? } — DB or send error
//
// Side effects:
//   1. INSERT into public.company_invitations (status='sent', expires in 7 days).
//   2. Calls supabase.auth.admin.inviteUserByEmail — Supabase creates auth.users
//      (if not exists) with raw_user_meta_data = { invite_token, companyName }
//      and sends our trilingual email template via Resend SMTP.
//
// On send failure the inserted invitation row is rolled back.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SITE_URL = 'https://crm.iamagent.app'
const RATE_LIMIT_PER_MIN = 10

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405)
  }

  try {
    // 1. Identify caller via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResp({ error: 'Missing authorization header' }, 401)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: authError } = await userClient.auth.getUser()
    if (authError || !userData?.user) {
      return jsonResp({ error: 'Invalid or expired token' }, 401)
    }
    const callerUserId = userData.user.id

    // 2. Parse and validate body
    let body: { email?: string; resend?: boolean }
    try {
      body = await req.json()
    } catch {
      return jsonResp({ error: 'Invalid JSON body' }, 400)
    }

    const email = (body.email ?? '').toString().trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResp({ error: 'Invalid email format' }, 400)
    }
    const isResend = body.resend === true

    // 3. Service-role client for privileged operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 4. Find caller's company where they are an active admin
    const { data: membership, error: memErr } = await adminClient
      .from('company_members')
      .select('company_id, companies(id, name)')
      .eq('user_id', callerUserId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .maybeSingle()

    if (memErr) {
      return jsonResp({ error: 'DB error reading membership', details: memErr.message }, 500)
    }
    if (!membership) {
      return jsonResp({ error: 'Caller is not a company admin', code: 'NOT_ADMIN' }, 403)
    }

    const companyId: string = membership.company_id
    const companyRaw = (membership as unknown as { companies?: { name?: string } }).companies
    const companyName: string = (companyRaw?.name ?? '').trim()

    if (!companyName) {
      return jsonResp(
        { error: 'Company is not activated (empty name)', code: 'COMPANY_NOT_ACTIVATED' },
        400,
      )
    }

    // 5. Rate-limit: max N invitations per minute per company
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentCount, error: rlErr } = await adminClient
      .from('company_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', oneMinuteAgo)

    if (rlErr) {
      return jsonResp({ error: 'DB error on rate-limit check', details: rlErr.message }, 500)
    }
    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MIN) {
      return jsonResp(
        { error: `Rate limit exceeded (max ${RATE_LIMIT_PER_MIN}/min)`, code: 'RATE_LIMITED' },
        429,
      )
    }

    // 5b. Resend branch: re-issue magic-link for existing invitation.
    // Used by "Send again" button when invite was already sent earlier (e.g. expired).
    // Skips check_email_status (auth.users may already exist as orphan from previous send).
    if (isResend) {
      const { data: existing, error: findErr } = await adminClient
        .from('company_invitations')
        .select('id, invite_token, status')
        .eq('company_id', companyId)
        .eq('email', email)
        .neq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findErr) {
        return jsonResp({ error: 'DB error finding invitation', details: findErr.message }, 500)
      }
      if (!existing) {
        return jsonResp(
          { error: 'No active invitation to resend', code: 'INVITATION_NOT_FOUND' },
          404,
        )
      }

      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: updErr } = await adminClient
        .from('company_invitations')
        .update({ status: 'sent', expires_at: newExpiresAt })
        .eq('id', existing.id)

      if (updErr) {
        return jsonResp({ error: 'Failed to refresh invitation', details: updErr.message }, 500)
      }

      const { error: resendErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${SITE_URL}/?invite_token=${existing.invite_token}`,
        data: {
          invite_token: existing.invite_token,
          companyName,
        },
      })

      if (resendErr) {
        return jsonResp(
          { error: 'Failed to resend invitation email', details: resendErr.message },
          500,
        )
      }

      return jsonResp(
        {
          success: true,
          invite_token: existing.invite_token,
          company_name: companyName,
          email,
          resent: true,
        },
        200,
      )
    }

    // 6. Email status (free / occupied / orphan)
    const { data: emailStatus, error: esErr } = await adminClient.rpc('check_email_status', {
      p_email: email,
    })
    if (esErr) {
      return jsonResp({ error: 'DB error on email check', details: esErr.message }, 500)
    }
    if (emailStatus === 'occupied') {
      return jsonResp({ error: 'Email already registered', code: 'EMAIL_OCCUPIED' }, 409)
    }
    if (emailStatus === 'orphan') {
      return jsonResp(
        {
          error: 'Email occupied by an orphan auth account; ask the agent for a different address',
          code: 'EMAIL_OCCUPIED_ORPHAN',
        },
        409,
      )
    }

    // 7. Insert invitation row (status='sent', expires_at default = now() + 7 days)
    const { data: invitation, error: insErr } = await adminClient
      .from('company_invitations')
      .insert({
        company_id: companyId,
        email,
        status: 'sent',
      })
      .select('invite_token')
      .single()

    if (insErr || !invitation) {
      return jsonResp(
        { error: 'Failed to create invitation', details: insErr?.message },
        500,
      )
    }

    // 8. Send invitation via Supabase Auth (creates auth.users + sends our email template)
    const { error: invErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/?invite_token=${invitation.invite_token}`,
      data: {
        invite_token: invitation.invite_token,
        companyName,
      },
    })

    if (invErr) {
      // Rollback the invitation row to keep state consistent
      await adminClient
        .from('company_invitations')
        .delete()
        .eq('invite_token', invitation.invite_token)
      return jsonResp(
        { error: 'Failed to send invitation email', details: invErr.message },
        500,
      )
    }

    return jsonResp(
      {
        success: true,
        invite_token: invitation.invite_token,
        company_name: companyName,
        email,
      },
      200,
    )
  } catch (e) {
    return jsonResp({ error: 'Internal server error', details: String(e) }, 500)
  }
})
