import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface PaymentSuccessEmailProps {
  businessName: string;
  plan: string;
  amount?: string | null;
  billingUrl?: string;
}

export function PaymentSuccessEmail({
  businessName,
  plan,
  amount,
  billingUrl,
}: PaymentSuccessEmailProps) {
  const finalBillingUrl = billingUrl || `${appUrl}/dashboard/billing`;

  return (
    <BaseTemplate
      previewText="Thank you! Your payment was successful and your plan is active."
      title="Payment Successful!"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        Thank you for your payment! We have successfully processed your transaction and your subscription is active. Here is a summary of your payment:
      </Text>

      <Section style={styles.detailsTable}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={styles.detailsLabel}>Active Subscription Plan</td>
            </tr>
            <tr>
              <td style={{ ...styles.detailsVal, textTransform: "capitalize" }}>
                {plan.replace("_", " ")} Plan
              </td>
            </tr>

            {amount && (
              <>
                <tr>
                  <td style={styles.detailsLabel}>Amount Paid</td>
                </tr>
                <tr>
                  <td style={styles.detailsVal}>{amount}</td>
                </tr>
              </>
            )}

            <tr>
              <td style={styles.detailsLabel}>Status</td>
            </tr>
            <tr>
              <td style={{ ...styles.detailsVal, color: "#10b981" }}>Active / Paid</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalBillingUrl} style={styles.button}>
          Manage Subscription
        </Button>
      </Section>

      <Text style={styles.text}>
        Your limits have been automatically refreshed and bumped in accordance with your new plan level. Enjoy your premium Agentify benefits!
      </Text>

      <Text style={styles.text}>
        If you have any questions or require an invoice copy, please reply directly to this message.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>The Agentify Billing Team</strong>
      </Text>
    </BaseTemplate>
  );
}
