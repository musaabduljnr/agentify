import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface UsageWarningEmailProps {
  businessName: string;
  usageType: string;
  percentage: number;
  billingUrl?: string;
}

export function UsageWarningEmail({
  businessName,
  usageType,
  percentage,
  billingUrl,
}: UsageWarningEmailProps) {
  const finalBillingUrl = billingUrl || `${appUrl}/dashboard/billing`;

  return (
    <BaseTemplate
      previewText={`Warning: You have reached ${percentage}% of your Agentify usage limit.`}
      title="Nearing Your Agentify Usage Limit"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>

      <Text style={styles.text}>
        We are writing to let you know that your workspace is approaching its resource limits. You have utilized{" "}
        <span style={{ ...styles.boldText, color: "#6366f1" }}>{percentage}%</span> of your allotted{" "}
        <strong>{usageType}</strong> quota for the current billing cycle.
      </Text>

      <Text style={styles.text}>
        Once your limits are fully exhausted, your AI assistant will be temporarily unable to answer new customer messages or collect leads until your next billing period resets, or until you upgrade your plan.
      </Text>

      <Section style={styles.btnContainer}>
        <Button href={finalBillingUrl} style={styles.button}>
          Upgrade Plan
        </Button>
      </Section>

      <Text style={styles.text}>
        Upgrading only takes a minute and ensures uninterrupted service, higher limits, and advanced AI engine options.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>The Agentify Team</strong>
      </Text>
    </BaseTemplate>
  );
}
