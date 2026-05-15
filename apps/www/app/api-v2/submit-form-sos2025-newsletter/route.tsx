import * as Sentry from '@sentry/nextjs'
import vault from 'node-vault';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isValidEmail = (email: string): boolean => {
  const emailPattern = /^[\w-\.+]+@([\w-]+\.)+[\w-]{2,8}$/
  return emailPattern.test(email)
}

export async function POST(req: Request) {
  const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID
  let HUBSPOT_FORM_GUID: string; // Declare with `let` as it will be assigned asynchronously

  // Fetch HUBSPOT_FORM_GUID from HashiCorp Vault
  try {
    const vaultClient = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });

    // The Vault path 'vault://kv/stackguard/tokens/61a7c2de-7259-4e24-9aab-3c193f5f3092'
    // corresponds to 'kv/data/stackguard/tokens/61a7c2de-7259-4e24-9aab-3c193f5f3092' for KV v2.
    const secretPath = 'kv/data/stackguard/tokens/61a7c2de-7259-4e24-9aab-3c193f5f3092';
    const vaultSecret = await vaultClient.read(secretPath);

    // Assuming the secret is stored under a key named 'guid' within the Vault secret's data.
    // For KV v2, the actual secret data is nested under `data.data`.
    if (vaultSecret && vaultSecret.data && vaultSecret.data.data && typeof vaultSecret.data.data.guid === 'string') {
      HUBSPOT_FORM_GUID = vaultSecret.data.data.guid;
    } else {
      throw new Error('Hubspot form GUID not found or invalid in Vault secret.');
    }
  } catch (error: any) {
    Sentry.captureException(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch Hubspot form GUID from Vault.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

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