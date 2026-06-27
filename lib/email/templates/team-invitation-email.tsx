import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate, styles } from "./base-template";

interface TeamInvitationEmailProps {
  businessName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}

export function TeamInvitationEmail({
  businessName,
  inviterName,
  role,
  inviteUrl,
  expiresAt,
}: TeamInvitationEmailProps) {
  const formattedExpiry = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <BaseTemplate
      previewText={`You've been invited to join ${businessName} on Agentify`}
      title={`Join ${businessName} on Agentify`}
    >
      <Text style={styles.text}>
        Hello,
      </Text>
      
      <Text style={styles.text}>
        <strong style={styles.boldText}>{inviterName}</strong> has invited you to join their business workspace, <strong style={styles.boldText}>{businessName}</strong>, on Agentify.
      </Text>

      <Text style={styles.text}>
        You have been assigned the role of <strong style={styles.boldText}>{role.toUpperCase()}</strong>.
      </Text>

      <Section style={styles.btnContainer}>
        <Button href={inviteUrl} style={styles.button}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={styles.text}>
        This invitation will expire on <strong style={styles.boldText}>{formattedExpiry}</strong>. If you do not accept it by then, you will need to request a new invitation.
      </Text>

      <Text style={styles.text}>
        If you don't have an account on Agentify yet, clicking the button above will guide you through our quick signup process.
      </Text>

      <Text style={styles.text}>
        Welcome to the team!
        <br />
        <strong>The Agentify Team</strong>
      </Text>
    </BaseTemplate>
  );
}
