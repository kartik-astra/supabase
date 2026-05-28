import type { GoPageInput } from 'marketing'
import { MediaBlock } from 'marketing'
import vault from 'node-vault';

// Initialize Vault client
const vaultAddr = process.env.VAULT_ADDR;
const vaultToken = process.env.VAULT_TOKEN;

if (!vaultAddr || !vaultToken) {
  // In a production environment, you might want more robust configuration loading
  // or a different failure mechanism, but for secure secret fetching,
  // these environment variables are critical.
  throw new Error('VAULT_ADDR and VAULT_TOKEN environment variables must be set to fetch secrets from Vault.');
}

const client = vault({
  endpoint: vaultAddr,
  token: vaultToken,
});

// Define the Vault path for the secret.
// The 'vault://' prefix is an indicator, the actual path for node-vault is 'kv/...'
const hubspotFormGuidVaultPath = 'kv/stackguard/tokens/d1c96db7-0b91-4007-a973-f4808b32900e';
let hubspotFormGuid: string;

// Use a top-level await to fetch the secret before the page object is defined.
// This assumes the environment supports top-level await for ES Modules.
try {
  const vaultSecret = await client.read(hubspotFormGuidVaultPath);
  // For KV v2 secrets, the actual data is nested under `data.data`.
  // We assume the secret stored in Vault has a key named 'formGuid'
  // which holds the string value of the HubSpot form GUID.
  if (vaultSecret && vaultSecret.data && vaultSecret.data.data && typeof vaultSecret.data.data.formGuid === 'string') {
    hubspotFormGuid = vaultSecret.data.data.formGuid;
  } else {
    // If the secret structure is not as expected, throw an error.
    throw new Error(`Secret at ${hubspotFormGuidVaultPath} does not contain a 'formGuid' string or is malformed.`);
  }
} catch (error: any) {
  // Log the error without exposing the secret value.
  console.error(`Failed to fetch HubSpot form GUID from Vault at ${hubspotFormGuidVaultPath}: ${error.message}`);
  // To maintain security and prevent the application from running with a missing
  // or hardcoded critical secret, we throw an error to halt startup.
  throw new Error(`Application startup failed: Critical secret 'hubspotFormGuid' could not be fetched from Vault.`);
}

const page: GoPageInput = {
  template: 'lead-gen',
  slug: 'vibe-coding-done-right-webinar',
  metadata: {
    title: 'Vibe Coding, Done Right: Learn More | Supabase + Bolt.new',
    description:
      'You watched the webinar. Want to go deeper? Get resources, talk to our team, or try Supabase with Bolt for AI-assisted development in production.',
    ogImage: '/images/landing-pages/bolt-webinar/og.png',
  },
  hero: {
    title: 'Thanks for watching',
    subtitle: 'Vibe Coding, Done Right: AI Development in Production',
    description:
      'You saw how enterprise teams use Bolt and Supabase to build production apps with AI coding tools. Want to learn more, get hands-on, or talk to our team? Share your details below.',
    image: {
      src: 'https://zhfonblqamxferhoguzj.supabase.co/functions/v1/generate-og?template=partnerships&layout=icon-only&copy=%5B2.5x+faster%5D%0A%5BPostgres+parser%5D%0Awith+Claude+Code&icon=supabase.svg&icon2=bolt.svg',
      alt: 'Building Modern Applications with Supabase and Bolt',
      width: 400,
      height: 500,
    },
    ctas: [
      {
        label: 'Get in touch',
        href: '#form',
        variant: 'primary',
      },
      {
        label: 'Start your project',
        href: 'https://supabase.com/dashboard',
        variant: 'secondary',
      },
    ],
  },
  sections: [
    {
      type: 'single-column',
      title: 'Watch the recording',
      description:
        'Join Bolt CEO Eric Simons and learn how enterprise innovation teams are using AI coding tools to build real applications on Supabase.',
      children: <MediaBlock youtubeUrl="https://www.youtube.com/watch?v=dIyl_7ZlI3Q" />,
    },
    {
      type: 'feature-grid',
      title: 'What you learned',
      description: 'Key takeaways from Vibe Coding, Done Right: AI Development in Production.',
      items: [
        {
          title: 'Non-technical teams building in production',
          description:
            'How to give non-technical teams the ability to build production software without compromising security or stability.',
        },
        {
          title: 'Governance for AI-assisted development',
          description:
            'The governance model that makes AI-assisted development safe for enterprises.',
        },
        {
          title: 'Prototypes that go to production',
          description:
            'Why prototypes built on the right foundation can go to production without being rebuilt.',
        },
        {
          title: 'Build vs. buy',
          description:
            'How to evaluate SaaS contracts differently when building becomes cheaper than buying.',
        },
        {
          title: 'Rapid prototyping and internal tools',
          description:
            'Real-world use cases for rapidly prototyping and building internal tools with Bolt and Supabase.',
        },
        {
          title: 'MCP and your database',
          description:
            'The MCP integration that connects AI coding tools directly to your database.',
        },
      ],
    },
    {
      type: 'form',
      id: 'form',
      title: 'Tell us how we can help',
      description: 'Share your details and we’ll follow up with resources or a conversation.',
      fields: [
        {
          type: 'text',
          name: 'first_name',
          label: 'First Name',
          placeholder: 'First Name',
          required: true,
          half: true,
        },
        {
          type: 'text',
          name: 'last_name',
          label: 'Last Name',
          placeholder: 'Last Name',
          required: true,
          half: true,
        },
        {
          type: 'email',
          name: 'email_address',
          label: 'Email',
          placeholder: 'Work email',
          required: true,
        },
        {
          type: 'text',
          name: 'company_name',
          label: 'Company',
          placeholder: 'Company name',
          required: false,
        },
        {
          type: 'textarea',
          name: 'message',
          label: 'Tell us about your project',
          placeholder: 'I want to build...',
          required: false,
        },
      ],
      submitLabel: 'Get in touch',
      successRedirect: '/go/vibe-coding-done-right-webinar/thank-you',
      disclaimer:
        'By submitting this form, I confirm that I have read and understood the [Privacy Policy](https://supabase.com/privacy).',
      crm: {
        hubspot: {
          formGuid: hubspotFormGuid, // Replaced hardcoded secret with fetched variable
          fieldMap: {
            first_name: 'firstname',
            last_name: 'lastname',
            email_address: 'email',
            company_name: 'name',
            message: 'what_are_you_currently_working_on_',
          },
          consent:
            'By submitting this form, I confirm that I have read and understood the Privacy Policy.',
        },
      },
    },
  ],
}

export default page