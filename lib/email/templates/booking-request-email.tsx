import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface BookingRequestEmailProps {
  businessName: string;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  requestedAction?: string | null;
  conversationUrl?: string;
}

export function BookingRequestEmail({
  businessName,
  leadName,
  leadEmail,
  leadPhone,
  requestedAction,
  conversationUrl,
}: BookingRequestEmailProps) {
  const finalConvUrl = conversationUrl || `${appUrl}/dashboard/conversations`;

  return (
    <BaseTemplate
      previewText="New booking request from your AI assistant!"
      title="New Booking / Schedule Request"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        A visitor has requested to book an appointment or schedule a consultation with your team. Here are the booking details:
      </Text>

      <Section style={styles.detailsTable}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={styles.detailsLabel}>Customer Name</td>
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
              <td style={styles.detailsLabel}>Action Requested</td>
            </tr>
            <tr>
              <td style={styles.detailsVal}>{requestedAction || "Schedule appointment"}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalConvUrl} style={styles.button}>
          Open Conversation
        </Button>
      </Section>

      <Text style={styles.text}>
        Please review the full conversation history to confirm their details and finalize their reservation or schedule slot.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>Your Agentify Assistant</strong>
      </Text>
    </BaseTemplate>
  );
}
