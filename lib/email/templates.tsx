import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://agentify.app";

type BaseEmailProps = {
  preview: string;
  title: string;
  children: React.ReactNode;
};

function BaseEmail({ preview, title, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Agentify</Text>
          <Heading style={styles.heading}>{title}</Heading>
          <Section>{children}</Section>
          <Text style={styles.footer}>
            Agentify sends transactional emails for account, lead, billing, and usage events.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function WelcomeEmail({ name }: { name?: string | null }) {
  const displayName = name || "there";

  return (
    <BaseEmail
      preview="Your Agentify workspace is ready."
      title={`Welcome to Agentify, ${displayName}`}
    >
      <Text style={styles.text}>
        Your AI business assistant workspace is ready. Finish onboarding, train your assistant, and publish your hosted chat or website widget when you are ready.
      </Text>
      <Button href={`${baseUrl}/dashboard`} style={styles.button}>
        Open dashboard
      </Button>
    </BaseEmail>
  );
}

export function LeadNotificationEmail({
  businessName,
  leadName,
  leadEmail,
  leadPhone,
  interest,
}: {
  businessName: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  interest?: string | null;
}) {
  return (
    <BaseEmail
      preview={`New lead captured for ${businessName}.`}
      title="New lead captured"
    >
      <Text style={styles.text}>Agentify captured a new lead for {businessName}.</Text>
      <Text style={styles.detail}>Name: {leadName || "Not provided"}</Text>
      <Text style={styles.detail}>Email: {leadEmail || "Not provided"}</Text>
      <Text style={styles.detail}>Phone: {leadPhone || "Not provided"}</Text>
      <Text style={styles.detail}>Interest: {interest || "General inquiry"}</Text>
      <Button href={`${baseUrl}/dashboard/leads`} style={styles.button}>
        View leads
      </Button>
    </BaseEmail>
  );
}

export function BookingSupportEmail({
  businessName,
  visitorName,
  visitorEmail,
  message,
}: {
  businessName: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  message: string;
}) {
  return (
    <BaseEmail
      preview={`New support request for ${businessName}.`}
      title="New booking or support request"
    >
      <Text style={styles.text}>A visitor asked for help from {businessName}.</Text>
      <Text style={styles.detail}>Visitor: {visitorName || "Not provided"}</Text>
      <Text style={styles.detail}>Email: {visitorEmail || "Not provided"}</Text>
      <Text style={styles.quote}>{message}</Text>
      <Button href={`${baseUrl}/dashboard/conversations`} style={styles.button}>
        View conversation
      </Button>
    </BaseEmail>
  );
}

export function PaymentEmail({
  planName,
  status,
  amount,
}: {
  planName: string;
  status: "success" | "failed" | "past_due";
  amount?: string | null;
}) {
  const title =
    status === "success"
      ? "Payment confirmed"
      : status === "past_due"
        ? "Payment needs attention"
        : "Payment failed";

  return (
    <BaseEmail preview={`${title} for your Agentify subscription.`} title={title}>
      <Text style={styles.text}>
        Your {planName} subscription payment status is {status.replace("_", " ")}.
      </Text>
      {amount ? <Text style={styles.detail}>Amount: {amount}</Text> : null}
      <Button href={`${baseUrl}/dashboard/billing`} style={styles.button}>
        Open billing
      </Button>
    </BaseEmail>
  );
}

export function UsageWarningEmail({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <BaseEmail preview={`${label} usage warning for Agentify.`} title={`${label} usage warning`}>
      <Text style={styles.text}>
        Your workspace has used {used.toLocaleString()} of {limit.toLocaleString()} included {label.toLowerCase()}.
      </Text>
      <Button href={`${baseUrl}/dashboard/billing`} style={styles.button}>
        Review usage
      </Button>
    </BaseEmail>
  );
}

const styles = {
  body: {
    margin: 0,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    margin: "0 auto",
    padding: "32px 24px",
    maxWidth: "560px",
    backgroundColor: "#ffffff",
  },
  brand: {
    color: "#4f46e5",
    fontSize: "18px",
    fontWeight: "700",
    margin: "0 0 24px",
  },
  heading: {
    color: "#0f172a",
    fontSize: "28px",
    lineHeight: "36px",
    margin: "0 0 16px",
  },
  text: {
    color: "#334155",
    fontSize: "16px",
    lineHeight: "24px",
  },
  detail: {
    color: "#334155",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "6px 0",
  },
  quote: {
    borderLeft: "3px solid #4f46e5",
    color: "#334155",
    fontSize: "14px",
    lineHeight: "22px",
    paddingLeft: "14px",
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "700",
    marginTop: "18px",
    padding: "12px 18px",
    textDecoration: "none",
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "18px",
    marginTop: "32px",
    paddingTop: "18px",
  },
} satisfies Record<string, React.CSSProperties>;
