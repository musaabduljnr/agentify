import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface PaymentFailedEmailProps {
  businessName: string;
  plan: string;
  billingUrl?: string;
}

export function PaymentFailedEmail({
  businessName,
  plan,
  billingUrl,
}: PaymentFailedEmailProps) {
  const finalBillingUrl = billingUrl || `${appUrl}/dashboard/billing`;

  return (
    <BaseTemplate
      previewText="Action required: Your payment transaction has failed."
      title="Payment Failed — Action Required"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        We were unable to process your payment for the <span style={styles.boldText}>{plan.replace("_", " ")}</span> subscription plan.
      </Text>

      <Text style={styles.text}>
        To prevent any disruption to your AI assistant services, embedding widget availability, or analytics panels, please update your billing details or retry the payment:
      </Text>

      <Section style={styles.detailsTable}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={styles.detailsLabel}>Subscription Plan</td>
            </tr>
            <tr>
              <td style={{ ...styles.detailsVal, textTransform: "capitalize" }}>
                {plan.replace("_", " ")} Plan
              </td>
            </tr>

            <tr>
              <td style={styles.detailsLabel}>Payment Status</td>
            </tr>
            <tr>
              <td style={{ ...styles.detailsVal, color: "#ef4444" }}>Declined / Failed</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalBillingUrl} style={styles.button}>
          Update Payment Method
        </Button>
      </Section>

      <Text style={styles.text}>
        Common issues include insufficient funds, expired cards, or temporary bank blocks. If the issue persists, you may want to contact your bank or choose a different payment method.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>The Agentify Billing Team</strong>
      </Text>
    </BaseTemplate>
  );
}
