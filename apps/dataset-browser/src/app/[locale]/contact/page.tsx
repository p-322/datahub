import {LocalizedMarkdown} from '@colonial-collections/ui';

// Sawubona: SendGrid contact form removed (see the researcher app's contact
// page). The dataset-browser is not deployed for Sawubona.
export default function Contact() {
  return (
    <LocalizedMarkdown
      name="contact"
      contentPath="@colonial-collections/content"
    />
  );
}
