import {LocalizedMarkdown} from '@p-322/ui';
import {getTranslations} from 'next-intl/server';

// Sawubona: no contact form. Plain "Mail us" text for now; how contact works
// is decided later.
export default async function Contact() {
  const t = await getTranslations('Contact');

  return (
    <>
      <LocalizedMarkdown name="contact" contentPath="@p-322/content" />
      <p className="font-semibold">{t('mailUs')}</p>
    </>
  );
}
