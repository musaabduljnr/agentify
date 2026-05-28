import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles, appUrl } from "./base-template";

interface WelcomeEmailProps {
  businessName: string;
  dashboardUrl?: string;
}

export function WelcomeEmail({ businessName, dashboardUrl }: WelcomeEmailProps) {
  const finalDashboardUrl = dashboardUrl || `${appUrl}/dashboard`;

  return (
    <BaseTemplate
      previewText="Your Agentify workspace is ready! Let's get started."
      title="Welcome to Agentify!"
    >
      <Text style={styles.text}>
        Hello <span style={styles.boldText}>{businessName}</span>,
      </Text>
      
      <Text style={styles.text}>
        Your AI business assistant workspace has been successfully created and configured. You are now ready to scale your customer relations and automate lead collection effortlessly!
      </Text>

      <Text style={styles.text}>
        Here are the immediate next steps to maximize your Agentify setup:
      </Text>

      <Section style={{ paddingLeft: "10px", margin: "16px 0" }}>
        <Text style={styles.text}>
          🚀 <strong>Train your AI Assistant</strong>: Upload FAQ sheets, manuals, or paste your website URL to align your assistant with your business policies.
        </Text>
        <Text style={styles.text}>
          💬 <strong>Embed the Chat Widget</strong>: Copy the single line of JavaScript code and paste it on your website to go live immediately.
        </Text>
        <Text style={styles.text}>
          📊 <strong>Track Conversations</strong>: Keep an eye on leads, customer tickets, and conversation transcripts in real time.
        </Text>
      </Section>

      <Section style={styles.btnContainer}>
        <Button href={finalDashboardUrl} style={styles.button}>
          Go to Dashboard
        </Button>
      </Section>

      <Text style={styles.text}>
        We are thrilled to help you automate your client communications! If you have any questions or need direct assistance, simply hit reply to this email or contact our support team.
      </Text>

      <Text style={styles.text}>
        Best regards,
        <br />
        <strong>The Agentify Team</strong>
      </Text>
    </BaseTemplate>
  );
}
