import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface SupportRequestEmailProps {
  businessName: string;
  leadName?: string | null;
  leadEmail?: string | null;
  issueSummary: string;
  conversationUrl?: string;
}

export function SupportRequestEmail({
  businessName,
  leadName,
  leadEmail,
  issueSummary,
  conversationUrl,
}: SupportRequestEmailProps) {
  const finalConvUrl = conversationUrl || `${appUrl}/dashboard/conversations`;

  return (
    <BaseTemplate
      previewText="New support request from your AI assistant!"
      title="New Customer Support Request"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        Your AI assistant has detected a customer support issue or ticket in a chat conversation. Below are the details of the request:
      </Text>

      <Section style={styles.detailsTable}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={styles.detailsLabel}>Customer Name</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>{leadName || "Visitor"}</td>
            </tr>

            <tr>
              <td style={styles.detailsLabel}>Email Address</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>
                {leadEmail ? (
                  <a href={`mailto:${leadEmail}`} style={{ color: "#6366f1", textDecoration: "none" }}>
                    {leadEmail}
                  </a>
                ) : (
                  "Not provided"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Text style={{ ...styles.detailsLabel, marginLeft: "4px" }}>Customer Message / Issue Summary</Text>
      <Section style={styles.quoteBlock}>
        "{issueSummary}"
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalConvUrl} style={styles.button}>
          Take Over Chat
        </Button>
      </Section>

      <Text style={styles.text}>
        You can hop directly into the conversation to chat live with the customer and resolve their issue.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>Your Agentify Assistant</strong>
      </Text>
    </BaseTemplate>
  );
}
