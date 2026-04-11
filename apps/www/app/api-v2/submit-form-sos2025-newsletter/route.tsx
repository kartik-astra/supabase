```typescript
import * as Sentry from '@sentry/nextjs'
import vault from 'node-vault'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isValidEmail = (email: string): boolean => {
  const emailPattern = /^[\w-\.+]+@([\w-]+\.)+[\w-]{2,8}$/
  return emailPattern.test(email)
}

export async function POST(req: Request) {
  const vaultClient = vault({
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  })

  const secretData = await vaultClient.read('kv/data/stackguard/tokens/f543bf2d-39a4-423f-b532-b44f4f6d6024')
  const HUBSPOT_FORM_GUID = secretData.data.data.token

  const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID

  const body = await req.json()
  const { email } = body

  if (!email) {
    return new Response(JSON.stringify({ message: 'All fields are required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 422,
    })
  }

  // Validate email
  if (email && !isValidEmail(email)) {
    return new Response(JSON.stringify({ message: 'Invalid email address' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 422,
    })
  }

  try {
    const response = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: [{ objectTypeId: '0-1', name: 'email', value: email }],
          context: {
            pageUri: 'https://supabase.com/state-of-startups',
            pageName: 'State of Startups 2025',
          },
          legalConsentOptions: {
            consent: {
              consentToProcess: true,
              text: 'By submitting this form, I confirm that I have read and understood the Privacy Policy.',
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      Sentry.captureException(errorData)
      return new Response(JSON.stringify({ message: errorData.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      })
    }

    return new Response(JSON.stringify({ message: 'Submission successful' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    Sentry.captureException(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}