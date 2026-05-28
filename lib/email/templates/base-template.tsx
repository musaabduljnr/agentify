import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface BaseTemplateProps {
  previewText: string;
  title: string;
  children: React.ReactNode;
}

export const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app";
export const supportEmail = process.env.SUPPORT_EMAIL || "support@agentifyhq.com";

export function BaseTemplate({ previewText, title, children }: BaseTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Logo Branding */}
          <Section style={styles.logoSection}>
            <Text style={styles.brandText}>Agentify</Text>
          </Section>

          {/* Card Frame */}
          <Section style={styles.cardFrame}>
            <Heading style={styles.heading}>{title}</Heading>
            <Section style={styles.contentBody}>{children}</Section>
          </Section>

          {/* Footer */}
          <Section style={styles.footerSection}>
            <Text style={styles.footerText}>
              This is a transactional email sent by Agentify to help manage your workspace and customer relations.
            </Text>
            <Text style={styles.footerLinkText}>
              Need help? Reach out to us at{" "}
              <a href={`mailto:${supportEmail}`} style={styles.supportLink}>
                {supportEmail}
              </a>
            </Text>
            <Text style={styles.copyrightText}>
              © {new Date().getFullYear()} Agentify. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// React Email compatible inline styles
const Heading = ({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) => (
  <h1 style={style}>{children}</h1>
);

export const styles = {
  body: {
    margin: 0,
    backgroundColor: "#f4f5f7",
    color: "#1e293b",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: "30px 15px",
  },
  container: {
    margin: "0 auto",
    maxWidth: "580px",
    width: "100%",
  },
  logoSection: {
    textAlign: "center" as const,
    paddingBottom: "20px",
  },
  brandText: {
    color: "#6366f1",
    fontSize: "24px",
    fontWeight: "800",
    letterSpacing: "-0.05em",
    margin: 0,
    textTransform: "uppercase" as const,
  },
  cardFrame: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "36px 30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02)",
  },
  heading: {
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: "800",
    lineHeight: "30px",
    margin: "0 0 20px",
    textAlign: "left" as const,
    letterSpacing: "-0.02em",
  },
  contentBody: {
    margin: 0,
  },
  text: {
    color: "#475569",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  boldText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  detailsTable: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    padding: "16px 20px",
    border: "1px solid #edf2f7",
    margin: "24px 0",
  },
  detailsLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    paddingBottom: "4px",
  },
  detailsVal: {
    color: "#1e293b",
    fontSize: "14px",
    fontWeight: "600",
    paddingBottom: "12px",
  },
  quoteBlock: {
    borderLeft: "4px solid #6366f1",
    backgroundColor: "#f5f3ff",
    borderRadius: "0 8px 8px 0",
    padding: "16px 20px",
    margin: "24px 0",
    fontStyle: "italic",
    color: "#4f46e5",
    fontSize: "14px",
    lineHeight: "22px",
  },
  btnContainer: {
    textAlign: "center" as const,
    margin: "24px 0 10px",
  },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: "12px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "700",
    padding: "14px 28px",
    textDecoration: "none",
    textAlign: "center" as const,
    boxShadow: "0 4px 10px rgba(99, 102, 241, 0.3)",
  },
  footerSection: {
    textAlign: "center" as const,
    paddingTop: "24px",
    paddingBottom: "10px",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 10px",
  },
  footerLinkText: {
    color: "#64748b",
    fontSize: "12px",
    margin: "0 0 10px",
    fontWeight: "500",
  },
  supportLink: {
    color: "#6366f1",
    textDecoration: "none",
    fontWeight: "600",
  },
  copyrightText: {
    color: "#cbd5e1",
    fontSize: "11px",
    margin: 0,
    fontWeight: "500",
  },
} as Record<string, React.CSSProperties>;
