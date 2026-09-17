import {LocalizedMarkdown} from '@colonial-collections/ui';

// Sawubona: the SendGrid contact form (@colonial-collections/email-sender) is
// dropped — that package throws at import time without SENDGRID_* env, which
// also broke `next build`. Contact details live in the localized markdown.
export default function Contact() {
  return (
    <LocalizedMarkdown
      name="contact"
      contentPath="@colonial-collections/content"
    />
  );
}
