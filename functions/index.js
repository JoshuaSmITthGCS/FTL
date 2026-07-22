import { initializeApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import nodemailer from 'nodemailer';

initializeApp();

const mailHost = defineString('MAIL_HOST', {
  default: 'smtp.office365.com',
  description: 'SMTP server hostname'
});
const mailPort = defineInt('MAIL_PORT', {
  default: 587,
  description: 'SMTP server port'
});
const mailUser = defineString('MAIL_USER', {
  description: 'SMTP login and From email address'
});
const mailPassword = defineSecret('MAIL_PASSWORD');

const REQUEST_RECIPIENT = 'freetextbooklibrary@cofc.edu';

function clean(value, fallback = 'None') {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, 2000) : fallback;
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

export const emailBookRequest = onDocumentCreated(
  {
    document: 'requests/{requestId}',
    region: 'us-east1',
    secrets: [mailPassword],
    timeoutSeconds: 60
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const request = snapshot.data();
    if (request.emailSentAt) return;

    const requesterEmail = clean(request.email, 'Not provided');
    const subject = `Book request: ${clean(request.bookTitle, 'Untitled book')}`;
    const fields = [
      ['Book', request.bookTitle],
      ['ISBN', request.bookIsbn],
      ['Author(s)', request.bookAuthor],
      ['Course', request.course],
      ['Availability Rating', request.availabilityRating],
      ['Name', request.name],
      ['Email', requesterEmail],
      ['Notes', request.message]
    ];

    const text = fields.map(([label, value]) => `${label}: ${clean(value)}`).join('\n');
    const html = `
      <h2>New textbook request</h2>
      <table cellpadding="6" cellspacing="0" border="0">
        ${fields.map(([label, value]) => `
          <tr>
            <th align="left" valign="top">${escapeHtml(label)}</th>
            <td>${escapeHtml(value)}</td>
          </tr>`).join('')}
      </table>
      <p>Request ID: ${escapeHtml(event.params.requestId)}</p>
    `;

    try {
      const transporter = nodemailer.createTransport({
        host: mailHost.value(),
        port: mailPort.value(),
        secure: mailPort.value() === 465,
        auth: {
          user: mailUser.value(),
          pass: mailPassword.value()
        }
      });

      await transporter.sendMail({
        from: `"Free Textbook Library Website" <${mailUser.value()}>`,
        to: REQUEST_RECIPIENT,
        replyTo: isEmail(request.email) ? String(request.email).trim() : undefined,
        subject,
        text,
        html
      });

      await snapshot.ref.update({
        emailStatus: 'sent',
        emailSentAt: FieldValue.serverTimestamp(),
        emailError: FieldValue.delete()
      });
    } catch (error) {
      await snapshot.ref.update({
        emailStatus: 'failed',
        emailAttemptedAt: FieldValue.serverTimestamp(),
        emailError: clean(error?.message || error, 'Unknown email error').slice(0, 500)
      });
      throw error;
    }
  }
);
