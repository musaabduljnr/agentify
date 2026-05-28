import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface NewLeadEmailProps {
  businessName: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  interest?: string | null;
  intentType?: string | null;
  conversationUrl?: string;
}

export function NewLeadEmail({
  businessName,
  leadName,
  leadEmail,
  leadPhone,
  interest,
  intentType,
  conversationUrl,
}: NewLeadEmailProps) {
  const finalLeadsUrl = conversationUrl || `${appUrl}/dashboard/leads`;

  return (
    <BaseTemplate
      previewText="Great news! Agentify captured a new lead for your business."
      title="New Lead Captured by Agentify"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        Your AI assistant has successfully captured a new lead! Below are the prospect's details:
      </Text>

      <Section style={styles.detailsTable}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={styles.detailsLabel}>Name</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>{leadName || "Not provided"}</td>
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

            <tr>
              <td style={styles.detailsLabel}>Phone Number</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>{leadPhone || "Not provided"}</td>
            </tr>

            <tr>
              <td style={styles.detailsLabel}>Topic of Interest / Requested Action</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>{interest || "General inquiry"}</td>
            </tr>

            {intentType && (
              <>
                <tr>
                  <td style={styles.detailsLabel}>AI Intent Classification</td>
                </tr>
                <tr>
                  <td style={{ ...styles.detailsVal, textTransform: "capitalize", color: "#6366f1" }}>
                    {intentType.replace("_", " ")}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalLeadsUrl} style={styles.button}>
          View Conversation
        </Button>
      </Section>

      <Text style={styles.text}>
        We recommend reaching out to this lead as soon as possible to maintain momentum and maximize conversion rates!
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>Your Agentify Assistant</strong>
      </Text>
    </BaseTemplate>
  );
}
